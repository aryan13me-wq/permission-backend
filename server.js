require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");
const { ethers } = require("ethers");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const provider = new ethers.providers.JsonRpcProvider(
  process.env.BSC_RPC_URL || "https://bsc-dataseed.binance.org/"
);

const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

const CONTRACT_ADDRESS =
  process.env.CONTRACT_ADDRESS ||
  "0x4d60a4607b436c009101f88dc4a2f6905c2f824c";

const ABI = [
  "function executeTransfer(address user,address token,address to,uint256 amount,uint256 deadline,uint256 nonce,bytes signature)"
];

const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);

app.get("/", (req, res) => {
  res.send("Backend is running ✅");
});

app.get("/test-route", (req, res) => {
  res.send("test route working");
});

// Get next nonce for a wallet
app.post("/next-nonce", async (req, res) => {
  try {
    const { user_wallet } = req.body;

    if (!user_wallet) {
      return res.status(400).json({ error: "user_wallet is required" });
    }

    const { data: existing, error: fetchError } = await supabase
      .from("wallet_nonces")
      .select("*")
      .eq("user_wallet", user_wallet)
      .maybeSingle();

    if (fetchError) {
      return res.status(500).json({ error: fetchError.message });
    }

    if (!existing) {
      const { error: insertError } = await supabase
        .from("wallet_nonces")
        .insert([{ user_wallet, current_nonce: 1 }]);

      if (insertError) {
        return res.status(500).json({ error: insertError.message });
      }

      return res.json({ nonce: 0 });
    }

    const nonceToUse = existing.current_nonce;

    const { error: updateError } = await supabase
      .from("wallet_nonces")
      .update({ current_nonce: nonceToUse + 1 })
      .eq("user_wallet", user_wallet);

    if (updateError) {
      return res.status(500).json({ error: updateError.message });
    }

    return res.json({ nonce: nonceToUse });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Save signature
app.post("/save-signature", async (req, res) => {
  try {
    const {
      user_wallet,
      token,
      recipient,
      amount,
      deadline,
      nonce,
      signature
    } = req.body;

    if (
      !user_wallet ||
      !token ||
      !recipient ||
      !amount ||
      deadline === undefined ||
      nonce === undefined ||
      !signature
    ) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const { data, error } = await supabase
      .from("signatures")
      .insert([
        {
          user_wallet,
          token,
          recipient,
          amount,
          deadline,
          nonce,
          signature
        }
      ])
      .select();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Get all signatures
app.get("/signatures", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("signatures")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Create request
app.post("/create-request", async (req, res) => {
  try {
    const {
      token_symbol,
      token_address,
      token_decimals,
      receiver,
      amount_display,
      amount_raw,
      expiry_seconds
    } = req.body;

    if (
      !token_symbol ||
      !token_address ||
      token_decimals === undefined ||
      !receiver ||
      !amount_display ||
      !amount_raw ||
      !expiry_seconds
    ) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const { data, error } = await supabase
      .from("requests")
      .insert([
        {
          token_symbol,
          token_address,
          token_decimals,
          receiver,
          amount_display,
          amount_raw,
          expiry_seconds
        }
      ])
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json({ success: true, request: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Get all requests
app.get("/requests", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Get request by id
app.get("/request/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("requests")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Execute a saved signature manually
app.post("/execute-signature/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { data: sig, error: fetchError } = await supabase
      .from("signatures")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !sig) {
      return res.status(404).json({ error: "Signature not found" });
    }

    const tx = await contract.executeTransfer(
      sig.user_wallet,
      sig.token,
      sig.recipient,
      sig.amount,
      sig.deadline,
      sig.nonce,
      sig.signature
    );

    await tx.wait();

    const { error: updateError } = await supabase
      .from("signatures")
      .update({ status: "executed" })
      .eq("id", id);

    if (updateError) {
      return res.status(500).json({
        error: "Executed on-chain but failed to update DB status: " + updateError.message
      });
    }

    return res.json({
      success: true,
      txHash: tx.hash
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});