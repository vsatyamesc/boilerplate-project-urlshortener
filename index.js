require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
const mongoose = require("mongoose");
const url = require("url");
const dns = require("dns");
const USER = process.env.USER;
const PASS = process.env.PASS;
const port = process.env.PORT || 3000;
const bodyParser = require("body-parser");
app.use(bodyParser.urlencoded({ extended: false }));
const DB_URI = `mongodb+srv://${USER}:${PASS}@cluster0.uid2hsv.mongodb.net/UrlShortner?retryWrites=true&w=majority&appName=Cluster0`;
app.use(cors());
app.use("/public", express.static(`${process.cwd()}/public`));

app.get("/", function (req, res) {
  res.sendFile(process.cwd() + "/views/index.html");
});

const mongoUri = DB_URI;
mongoose
  .connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.log(err));

// Schema
const urlSchema = new mongoose.Schema({
  original_url: { type: String, required: true }, // changed to original_url
  short_url: { type: Number, required: true }, // changed to short_url
});


const counterSchema = new mongoose.Schema({
  name: { type: String, required: true },
  value: { type: Number, required: true },
});

const Url = mongoose.model("Url", urlSchema);
const Counter = mongoose.model("Counter", counterSchema);

async function getNextUrlCount() {
  const counter = await Counter.findOneAndUpdate(
    { name: "urlCount" },
    { $inc: { value: 1 } },
    { new: true, upsert: true }
  );
  return counter.value;
}
function validateUrl(submittedUrl, callback) {
  const parsedUrl = url.parse(submittedUrl);
  const hostname = parsedUrl.hostname;

  dns.lookup(hostname, (err) => {
    if (err) {
      callback(false);
    } else {
      callback(true);
    }
  });
}
app.post("/api/shorturl", async (req, res) => {
  const { url: submittedUrl } = req.body;

  // Validate the URL format
  const urlPattern = /^https?:\/\/(www\.)?.+$/;
  if (!urlPattern.test(submittedUrl)) {
    return res.json({ error: "invalid url" });
  }
  validateUrl(submittedUrl, async (isValid) => {
    if (!isValid) {
      return res.json({ error: "invalid url" });
    }

    try {
      let existingUrl = await Url.findOne({ original_url: submittedUrl });
      if (existingUrl) {
        return res.json({
          original_url: existingUrl.original_url,
          short_url: existingUrl.short_url,
        });
      }
      const urlCount = await Url.countDocuments();
      const newShortUrl = urlCount + 1;
      const newUrl = new Url({
        original_url: submittedUrl,
        short_url: newShortUrl,
      });
      await newUrl.save();

      res.json({
        original_url: newUrl.original_url,
        short_url: newUrl.short_url,
      });
    } catch (err) {
      res.status(500).json({ error: "Server error" });
    }
  });
});
app.get("/api/shorturl/:short_url", async (req, res) => {
  const { short_url } = req.params;

  try {
    const foundUrl = await Url.findOne({ short_url: short_url });
    if (!foundUrl) {
      return res.json({ error: "No short URL found" });
    }
    res.redirect(foundUrl.original_url);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});
app.listen(port, function () {
  console.log(`Listening on port ${port}`);
});
