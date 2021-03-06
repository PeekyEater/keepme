const path = require("path");
const fs = require("fs");
const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const flash = require("connect-flash");
const helmet = require("helmet");
const compression = require("compression");
const multer = require("multer");

const forceHTTPS = require("./middleware/forceHTTPS");

const errorController = require("./controllers/error");
const sequelize = require("./util/database");
const reminderController = require("./util/reminderController");
const appDataInitialize = require("./util/appDataInitialize");

const User = require("./models/user");
const Note = require("./models/note");
const Color = require("./models/color");
const Tag = require("./models/tag");
const Reminder = require("./models/reminder");
const Language = require("./models/language");
const TagNoteItem = require("./models/tagnoteitem");

const mainRoutes = require("./routes/main");
const authRoutes = require("./routes/auth");
const adminRoutes = require("./routes/admin");

const imageFilter = (req, file, cb) => {
  if (
    file.mimetype === "image/png" ||
    file.mimetype === "image/jpg" ||
    file.mimetype === "image/jpeg" ||
    file.mimetype === "application/json"
  ) {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

const app = express();

app.set("view engine", "ejs");
app.set("views", "views");

app.use(helmet());
app.use(compression());

if (process.env.NODE_ENV === "production") {
  app.use(forceHTTPS);
}

app.use(bodyParser.urlencoded({ extended: false }));
app.use(multer({ dest: "images", fileFilter: imageFilter }).single("file"));

app.use(express.static(path.join(__dirname, "public")));
app.use("/images", express.static(path.join(__dirname, "images")));

app.use(
  session({
    secret: "my secret",
    resave: false,
    saveUninitialized: false,
  })
);

app.use(flash());

app.use((req, res, next) => {
  if (
    !req.session.isLoggedIn &&
    !(
      req.url === "/auth/login" ||
      req.url.includes("/auth/signup") ||
      req.url === "/auth/set-new-password" ||
      req.url.includes("/auth/forgot-password")
    )
  ) {
    return res.redirect("/auth/login");
  } else next();
});

app.use((req, res, next) => {
  if (!req.session.isAdmin && req.url.includes("admin")) {
    return res.redirect("/");
  } else next();
});

app.use((req, res, next) => {
  if (req.session && req.session.locale) {
    res.locals.locale = req.session.locale;
  } else {
    res.locals.locale = "ru";
  }
  res.locals.isAuthenticated = req.session.isLoggedIn;
  res.locals.isAdmin = req.session.isAdmin;
  next();
});

app.use(mainRoutes);
app.use("/auth", authRoutes);
app.use("/admin", adminRoutes);

app.use(errorController.get404);

Language.hasMany(User);
User.belongsTo(Language);

User.hasMany(Note, { onDelete: "CASCADE" });
Note.belongsTo(User, { onDelete: "CASCADE" });

Note.belongsTo(Color);
Color.hasMany(Note);

User.hasMany(Tag, { onDelete: "CASCADE" });
Tag.belongsTo(User, { onDelete: "CASCADE" });

Note.hasMany(Reminder), { onDelete: "CASCADE" };
Reminder.belongsTo(Note, { onDelete: "CASCADE" });

Note.belongsToMany(Tag, {
  through: TagNoteItem,
  onDelete: "CASCADE",
});
Tag.belongsToMany(Note, {
  through: TagNoteItem,
  onDelete: "CASCADE",
});

const isForceSync = process.env.FORCE_SYNC;

const syncConfig = isForceSync ? { force: true } : {};

sequelize
  .sync(syncConfig)
  .then(() => {
    setInterval(reminderController, 1000 * 60 * 60);
  })
  .then(() => {
    app.listen(process.env.PORT || 3000);
  })
  .then(() => {
    if (isForceSync) {
      appDataInitialize();
    }
  })
  .catch((err) => {
    console.log(err);
  });
