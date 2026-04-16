const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const dataFile = path.join(__dirname, "signatures.json");

if (!fs.existsSync(dataFile)) {
  fs.writeFileSync(dataFile, "[]");
}

app.get("/", (req, res) => {
  res.send("Backend is running");
});

app.post("/save-signature", (req, res) => {
  try {
    const newData = req.body;

    if (
      newData.user === undefined ||
      newData.token === undefined ||
      newData.to === undefined ||
      newData.amount === undefined ||
      newData.deadline === undefined ||
      newData.nonce === undefined ||
      newData.signature === undefined
    ) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const existing = JSON.parse(fs.readFileSync(dataFile, "utf8"));

    existing.push({
      ...newData,
      savedAt: new Date().toISOString()
    });

    fs.writeFileSync(dataFile, JSON.stringify(existing, null, 2));

    res.json({ success: true, message: "Signature saved successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/signatures", (req, res) => {
  try {
    const existing = JSON.parse(fs.readFileSync(dataFile, "utf8"));
    res.json(existing);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});