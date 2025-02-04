const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());
const PORT = process.env.PORT || 3000;
const MONGODB =
  process.env.MONGO_URI || "mongodb://localhost:27017/imageUploadDB";

// Statische Dateien aus dem 'public' Ordner bereitstellen
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB connection
mongoose
  .connect(MONGODB)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Helper to get or create a Mongoose model for a user
const getUserImageModel = (username) => {
  if (mongoose.connection.models[username]) {
    return mongoose.connection.models[username];
  }

  const userImageSchema = new mongoose.Schema({
    status: { type: String, required: true},
    frontImagePath: { type: String, required: true },
    frontImageDescription: { type: String, required: false, default: null },
    backImagePath: { type: String, required: true },
    backImageDescription: { type: String, required: false, default: null  },
    prompt: { type: String, required: false, default: null},
    resultImagePath: { type: String, required: false, default: null },
    caption: { type: String, required: false, default: null  },
    emotion: { type: String, required: false, default: null  },
    uploadDate: { type: String, required: true }, // Date as string (YYYY-MM-DD)
    uploadTime: { type: String, required: true }, // Time as string (HH:MM:SS)
  });

  return mongoose.model(username, userImageSchema, username);
};

// Configure storage for multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const username = req.body.user;
    if (!username) {
      return cb(new Error("Username is required"));
    }

    const userUploadDirectory = `./uploads/${username}`;
    if (!fs.existsSync(userUploadDirectory)) {
      fs.mkdirSync(userUploadDirectory, { recursive: true });
    }
    cb(null, userUploadDirectory);
  },
  filename: (req, file, cb) => {
    if (!req.uploadRequestId) {
      const currentDate = new Date();
      const formattedDate = `${currentDate.getFullYear()}_${(
        currentDate.getMonth() + 1
      )
        .toString()
        .padStart(2, "0")}_${currentDate
        .getDate()
        .toString()
        .padStart(2, "0")}-${currentDate
        .getHours()
        .toString()
        .padStart(2, "0")}_${currentDate
        .getMinutes()
        .toString()
        .padStart(2, "0")}`;

      req.uploadRequestId = Math.floor(Math.random() * 1e9);
      req.formattedDate = formattedDate;
    }

    const fileField = file.fieldname; // 'front' or 'back'
    cb(
      null,
      `${req.formattedDate}-${fileField}-${req.uploadRequestId}${path.extname(
        file.originalname
      )}`
    );
  },
});

// Configure multer middleware
const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedFileTypes = /jpeg|jpg|png|gif/;
    const isExtnameValid = allowedFileTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const isMimetypeValid = allowedFileTypes.test(file.mimetype);

    if (isMimetypeValid && isExtnameValid) {
      return cb(null, true);
    }
    cb(new Error("Only image files (jpeg, jpg, png, gif) are allowed!"));
  },
});

// Middleware to parse JSON body
app.use(express.json());

// Route to handle image uploads
app.post(
  "/daily_upload",
  upload.fields([
    { name: "front", maxCount: 1 },
    { name: "back", maxCount: 1 },
  ]),
  async (req, res) => {
    if (!req.files || (!req.files["front"] && !req.files["back"])) {
      return res
        .status(400)
        .json({ error: "No files uploaded or invalid file format" });
    }

    const username = req.body.user;

    try {
      // Get the model for the user
      const UserImage = getUserImageModel(username);

      // Get current date and time
      const currentDate = new Date();
      const date = currentDate.toISOString().split("T")[0]; // Format: YYYY-MM-DD
      const time = currentDate.toTimeString().split(" ")[0]; // Format: HH:MM:SS

      // Create a new image entry for the user
      const newImageEntry = new UserImage({
        frontImagePath: req.files["front"]
          ? `uploads/${username}/${req.files["front"][0].filename}`
          : null,
        backImagePath: req.files["back"]
          ? `uploads/${username}/${req.files["back"][0].filename}`
          : null,
        status: "uploaded",
        uploadDate: date,
        uploadTime: time,
      });

      // Save the entry to the user's collection
      await newImageEntry.save();

      console.log(newImageEntry)

      // Reset request-specific properties after handling the request
      req.uploadRequestId = null;
      req.formattedDate = null;

      res.status(200).json({
        id: newImageEntry._id
      });
    } catch (err) {
      res.status(500).json({
        error: "Failed to save entry to database",
        details: err.message,
      });
    }
  }
);

// Route to get the caption of an image by ID
app.get("/caption", async (req, res) => {
  const { id, user } = req.query;

  if (!id || !user) {
    return res.status(400).json({ error: "ID and user are required parameters" });
  }

  try {
    // Get the model for the user
    const UserImage = getUserImageModel(user);

    // Find the entry by ID
    const entry = await UserImage.findById(id);

    if (!entry) {
      return res.status(404).json({ error: "Entry not found" });
    }

    // Check if the caption exists
    if (!entry.caption) {
      return res.status(404).json({ error: "Caption not available yet" });
    }

    // Return the caption
    res.status(200).json({ caption: entry.caption });
  } catch (err) {
    res.status(500).json({
      error: "Failed to retrieve caption from database",
      details: err.message,
    });
  }
});

// Route to download an image by ID
app.get("/download", async (req, res) => {
  const { id, user } = req.query;

  if (!id || !user) {
    return res.status(400).json({ error: "ID and user are required parameters" });
  }

  try {
    // Get the model for the user
    const UserImage = getUserImageModel(user);

    // Find the entry by ID
    const entry = await UserImage.findById(id);

    if (!entry) {
      return res.status(404).json({ error: "Entry not found" });
    }

    // Check if the result image path exists
    if (!entry.resultImagePath) {
      return res.status(404).json({ error: "Image not available yet" });
    }

    // Create the full file path
    const filePath = path.join(entry.resultImagePath);
    console.log(filePath)

    // Check if the file exists on the server
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found on server" });
    }

    // Send the file to the client
    res.download(filePath, (err) => {
      if (err) {
        console.error("Error sending file:", err);
        res.status(500).json({ error: "Failed to download the file" });
      }
    });
  } catch (err) {
    res.status(422).json({
      error: "Failed to retrieve or download the image",
      details: err.message,
    });
  }
});



// Error handler for multer
app.use((err, req, res, next) => {
  if (
    err instanceof multer.MulterError ||
    err.message === "Only image files (jpeg, jpg, png, gif) are allowed!" ||
    err.message === "Username is required"
  ) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
