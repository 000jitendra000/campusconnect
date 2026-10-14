
const express = require("express");
const session = require("express-session");
const path = require("path");
const db = require("./database");

const app = express();
const PORT = 3000;

const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "Campus@123";

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    name: "campusconnect.sid",
    secret: process.env.SESSION_SECRET || "campusconnect-change-this-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      maxAge: 30 * 60 * 1000
    }
  })
);

function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }

  return res.status(401).json({
    success: false,
    message: "Please log in as admin."
  });
}

// Homepage
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Admin page: check login BEFORE serving the file
app.get("/admin.html", (req, res) => {
  if (!req.session || !req.session.isAdmin) {
    return res.redirect("/admin-login.html");
  }

  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

// Login page
app.get("/admin-login.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin-login.html"));
});

// Serve CSS, JS, and other public assets
app.use(
  express.static(path.join(__dirname, "public"), {
    dotfiles: "deny",
    index: false
  })
);

// Check current login
app.get("/api/admin/session", (req, res) => {
  res.json({
    loggedIn: Boolean(req.session && req.session.isAdmin)
  });
});

// Admin login
app.post("/api/admin/login", (req, res, next) => {
  const { username, password } = req.body || {};

  if (
    username !== ADMIN_USERNAME ||
    password !== ADMIN_PASSWORD
  ) {
    return res.status(401).json({
      success: false,
      message: "Incorrect username or password."
    });
  }

  req.session.regenerate((err) => {
    if (err) return next(err);

    req.session.isAdmin = true;
    req.session.username = ADMIN_USERNAME;

    req.session.save((saveError) => {
      if (saveError) return next(saveError);

      res.json({
        success: true,
        message: "Login successful."
      });
    });
  });
});

// Admin logout
app.post("/api/admin/logout", (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);

    res.clearCookie("campusconnect.sid");
    res.json({
      success: true,
      message: "Logged out successfully."
    });
  });
});

// Public: list events
app.get("/api/events", (req, res) => {
  try {
    const events = db.prepare(`
      SELECT
        e.id,
        e.title,
        e.category,
        e.description,
        e.created_at,
        COUNT(r.id) AS registration_count
      FROM events e
      LEFT JOIN registrations r ON r.event_id = e.id
      GROUP BY e.id
      ORDER BY e.id DESC
    `).all();

    res.json(events);
  } catch (error) {
    console.error("Fetch events error:", error);
    res.status(500).json({
      success: false,
      message: "Could not load events."
    });
  }
});

// Admin: create an event
app.post("/api/events", requireAdmin, (req, res) => {
  const { title, category, description } = req.body || {};

  if (
    !title?.trim() ||
    !category?.trim() ||
    !description?.trim()
  ) {
    return res.status(400).json({
      success: false,
      message: "Please fill in all event fields."
    });
  }

  try {
    const result = db.prepare(`
      INSERT INTO events (title, category, description)
      VALUES (?, ?, ?)
    `).run(title.trim(), category.trim(), description.trim());

    res.status(201).json({
      success: true,
      message: "Event created successfully.",
      id: result.lastInsertRowid
    });
  } catch (error) {
    console.error("Create event error:", error);
    res.status(500).json({
      success: false,
      message: "Could not create the event."
    });
  }
});

// Admin: update an event
app.put("/api/events/:id", requireAdmin, (req, res) => {
  const { title, category, description } = req.body || {};
  const id = Number(req.params.id);

  if (
    !Number.isInteger(id) ||
    id < 1 ||
    !title?.trim() ||
    !category?.trim() ||
    !description?.trim()
  ) {
    return res.status(400).json({
      success: false,
      message: "Enter valid event details."
    });
  }

  try {
    const result = db.prepare(`
      UPDATE events
      SET title = ?, category = ?, description = ?
      WHERE id = ?
    `).run(title.trim(), category.trim(), description.trim(), id);

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        message: "Event not found."
      });
    }

    res.json({
      success: true,
      message: "Event updated successfully."
    });
  } catch (error) {
    console.error("Update event error:", error);
    res.status(500).json({
      success: false,
      message: "Could not update the event."
    });
  }
});

// Admin: delete an event and its registrations safely
app.delete("/api/events/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({
      success: false,
      message: "Invalid event ID."
    });
  }

  try {
    const deleteEvent = db.transaction(() => {
      db.prepare(
        "DELETE FROM registrations WHERE event_id = ?"
      ).run(id);

      return db.prepare(
        "DELETE FROM events WHERE id = ?"
      ).run(id);
    });

    const result = deleteEvent();

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        message: "Event not found."
      });
    }

    res.json({
      success: true,
      message: "Event and its registrations deleted."
    });
  } catch (error) {
    console.error("Delete event error:", error);
    res.status(500).json({
      success: false,
      message: "Could not delete the event."
    });
  }
});

// Public: register for an event
app.post("/api/events/:id/register", (req, res) => {
  const eventId = Number(req.params.id);
  const { student_name, student_email } = req.body || {};

  if (
    !Number.isInteger(eventId) ||
    eventId < 1 ||
    !student_name?.trim() ||
    !student_email?.trim()
  ) {
    return res.status(400).json({
      success: false,
      message: "Please enter your name and email."
    });
  }

  const email = student_email.trim().toLowerCase();
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailPattern.test(email)) {
    return res.status(400).json({
      success: false,
      message: "Please enter a valid email address."
    });
  }

  try {
    const event = db.prepare(
      "SELECT id FROM events WHERE id = ?"
    ).get(eventId);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "This event does not exist."
      });
    }

    const existingRegistration = db.prepare(`
      SELECT id
      FROM registrations
      WHERE event_id = ? AND lower(student_email) = ?
    `).get(eventId, email);

    if (existingRegistration) {
      return res.status(409).json({
        success: false,
        message: "This email is already registered for this event."
      });
    }

    db.prepare(`
      INSERT INTO registrations
        (event_id, student_name, student_email)
      VALUES (?, ?, ?)
    `).run(eventId, student_name.trim(), email);

    res.status(201).json({
      success: true,
      message: "Registration successful!"
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      success: false,
      message: "Registration failed. Please try again."
    });
  }
});

// Admin: dashboard registration statistics
app.get("/api/registrations/stats", requireAdmin, (req, res) => {
  try {
    const totals = db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM events) AS totalEvents,
        (SELECT COUNT(*) FROM registrations) AS totalRegistrations
    `).get();

    const perEvent = db.prepare(`
      SELECT
        e.id AS event_id,
        e.title,
        COUNT(r.id) AS registration_count
      FROM events e
      LEFT JOIN registrations r ON r.event_id = e.id
      GROUP BY e.id
      ORDER BY e.id DESC
    `).all();

    res.json({ ...totals, perEvent });
  } catch (error) {
    console.error("Statistics error:", error);
    res.status(500).json({
      success: false,
      message: "Could not load dashboard statistics."
    });
  }
});

// Admin: view all registrations
app.get("/api/registrations", requireAdmin, (req, res) => {
  try {
    const registrations = db.prepare(`
      SELECT
        r.id,
        r.event_id,
        r.student_name,
        r.student_email,
        r.registered_at,
        e.title AS event_title
      FROM registrations r
      JOIN events e ON e.id = r.event_id
      ORDER BY r.id DESC
    `).all();

    res.json(registrations);
  } catch (error) {
    console.error("Fetch registrations error:", error);
    res.status(500).json({
      success: false,
      message: "Could not load registrations."
    });
  }
});

// Admin: remove a registration
app.delete("/api/registrations/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({
      success: false,
      message: "Invalid registration ID."
    });
  }

  try {
    const result = db.prepare(
      "DELETE FROM registrations WHERE id = ?"
    ).run(id);

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        message: "Registration not found."
      });
    }

    res.json({
      success: true,
      message: "Registration removed."
    });
  } catch (error) {
    console.error("Remove registration error:", error);
    res.status(500).json({
      success: false,
      message: "Could not remove registration."
    });
  }
});

// Handle unexpected errors
app.use((err, req, res, next) => {
  console.error("Server error:", err);

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).json({
    success: false,
    message: "An unexpected server error occurred."
  });
});

app.listen(PORT, () => {
  console.log("CampusConnect database is ready!");
  console.log(`CampusConnect server running at http://localhost:${PORT}`);
});
