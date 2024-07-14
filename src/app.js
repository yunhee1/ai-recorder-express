const express = require("express");
const multer = require("multer");
const { Storage } = require("@google-cloud/storage");
const { SpeechClient } = require("@google-cloud/speech");
const axios = require("axios");
const dotenv = require("dotenv");

dotenv.config();

const testRouter = require("./routers/test");

const app = express();

const storage = new Storage({
  projectId: "ai-recoder",
  keyFilename: "ai-recoder-a1027e33f835.json",
});

const client = new SpeechClient({
  keyFilename: "ai-recoder-a1027e33f835.json",
});

const bucketName = "ai-recoder";
const bucket = storage.bucket(bucketName);

// multer
const upload = multer({
  storage: multer.memoryStorage(),
});

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use("/test", testRouter);

app.post("/upload", upload.single("audio"), (req, res) => {
  if (!req.file) {
    return res.status(400).send("No file uploaded");
  }

  console.log("uploading...");

  const blob = bucket.file(req.file.originalname);
  const blobStream = blob.createWriteStream({
    resumable: false,
    contentType: req.file.mimetype,
  });

  blobStream.on("error", (err) => {
    res.status(500).send({ message: err.message });
  });

  blobStream.on("finish", () => {
    const publicUrl = `https://storage.googleapis.com/${bucketName}/${blob.name}`;

    res.send({ fileUrl: publicUrl });
  });

  blobStream.end(req.file.buffer);

  res.send("true");
});

app.post("/transcribe", async (req, res) => {
  console.log("transcribe...");

  const gcsUri = "gs://ai-recoder/recording.m4a";

  const [operation] = await client.longRunningRecognize({
    config: {
      languageCode: "ko-KR",
      encoding: "WEBM_OPUS",
      sampleRateHertz: 48000,
      enableWordTimeOffsets: true,
    },
    audio: {
      uri: gcsUri,
    },
  });
  console.log("waiting for operation to complete");

  const name = operation.name;

  console.log(`name: ${name}`);
  res.json(name);
});

app.get("/:name", async (req, res) => {
  const name = req.params.name;

  const result = await axios.get(
    `https://speech.googleapis.com/v1/operations/${name}?key=${process.env.GOOGLE_API_KEY}`
  );

  const data = await result.data;

  console.log(data);

  res.json(data);
});

app.listen(3000, () => {
  console.log("Server init on port ", 3000);
});
