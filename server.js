const express = require("express");
const cors = require("cors");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const dataFile = "signatures.json";

// Create file if not exists
if (!fs.existsSync(dataFile)) {
  fs.writeFileSync(dataFile, "[]");
}

// Home route (for testing)
app.get("/", (req, res) => {
  res.send("Backend is running ✅");
});

// SAVE signature
app.post("/save-signature", (req, res) => {
  try {
    const { user, token, to, amount, deadline, nonce, signature } = req.body;

    if (!user || !token || !to || !amount || !deadline || !signature) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const existing = JSON.parse(fs.readFileSync(dataFile, "utf8"));

    const newEntry = {
      user,
      token,
      to,
      amount,
      deadline,
      nonce,
      signature,
      savedAt: new Date()
    };

    existing.push(newEntry);

    fs.writeFileSync(dataFile, JSON.stringify(existing, null, 2));

    res.json({ success: true });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all signatures
app.get("/signatures", (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(dataFile, "utf8"));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});