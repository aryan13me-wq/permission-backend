const express = require("express");
const cors = require("cors");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const dataFile = "signatures.json";

if (!fs.existsSync(dataFile)) {
  fs.writeFileSync(dataFile, "[]");
}

app.get("/", (req, res) => {
  res.send("Backend is running ✅");
});

app.post("/save-signature", (req, res) => {
  try {
    const { user, token, to, amount, deadline, nonce, signature } = req.body;

    if (
      user === undefined ||
      token === undefined ||
      to === undefined ||
      amount === undefined ||
      deadline === undefined ||
      nonce === undefined ||
      signature === undefined
    ) {
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
      savedAt: new Date().toISOString()
    };

    existing.push(newEntry);

    fs.writeFileSync(dataFile, JSON.stringify(existing, null, 2));

    res.json({ success: true, message: "Signature saved successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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