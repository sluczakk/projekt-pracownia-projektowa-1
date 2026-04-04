const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const crypto = require("crypto");

const exercises = require("./exercises");

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json({ limit: "50kb" }));

const SECRET_KEY = "sekretnyklucz";

app.use(express.static(path.join(__dirname, "public")));

// baza danych sqlite3

const dbPath = process.env.DATABASE_PATH || "/home/data/database.sqlite";

fs.mkdirSync("/home/data", { recursive: true });

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("DB error:", err.message);
  } else {
    console.log("Connected to SQLite DB");
  }
});

// tworzymy tabele z uzytkownikami
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE,
      password TEXT
    )
  `);
});

// ======== konta uzytkownikow ========

// rejestracja
app.post("/auth/register", async (req, res) => {
  const { email, password, repeatedpassword } = req.body;

  if (password !== repeatedpassword) {
    return res.status(400).json({ message: "Hasła nie pasują" });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);

  db.run(
    `INSERT INTO users (email, password) VALUES (?, ?)`,
    [email, hashedPassword],
    function (err) {
      if (err) {
        return res.status(400).json({ message: "Email już istnieje" });
      }

      const user = {
        id: this.lastID,
        email,
      };

      const token = jwt.sign(user, SECRET_KEY, { expiresIn: "7d" });

      res.json({ token, user });
    }
  );
});

// logowanie
app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;

  db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
    if (!user) {
      return res.status(401).json({ message: "Nie istnieje konto z podanym emailem" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: "Złe hasło" });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      SECRET_KEY,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: { id: user.id, email: user.email },
    });
  });
});

// weryfikacja tokena
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) return res.status(401).json({ message: "Brak tokenu" });

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: "Nieprawidłowy token" });
  }
}

app.get("/auth/verifytoken", authMiddleware, (req, res) => {
  res.json({ user: req.user });
});


// ======== odpalanie kodu ========

const MAX_STDOUT = 5000;

const memorylimit = "64m";
const cpuslimit = "0.5";
const securityopt = "no-new-privileges";
const pidslimit = "64";

function cleanupJobDir(jobDir) {
  setTimeout(() => {
    fs.rm(jobDir, { recursive: true, force: true }, () => {});
  }, 200);
}


app.post("/run", (req, res) => {
  const code = req.body?.code; // Przesłany kod
  const language = req.body?.language; // Wybrany język
  const exerciseid = req.body?.exerciseid; // wybrane zadanie; jezeli puste, to brak

  let exercise = exercises[exerciseid];

  let stdout = " "; // Zwracane wartości
  let stderr = " "; // Zwracane błędy
  let returncode = 0;
  let finished = false;

  const finish = (payload) => {
      if (!finished) {
        finished = true;
        //console.log("kod2: " + JSON.stringify(payload));
        res.json(payload);
      }
    };

  //console.log("kod1: " + code);

  if (language == "python" || language == "java" || language == "cpp") {
    const jobId = crypto.randomUUID();
    const jobDir = path.join(__dirname, "temp", jobId);

    fs.mkdirSync(jobDir, { recursive: true });

    if (language == "python")
      fs.writeFileSync(path.join(jobDir, "main.py"), code);
    else if (language == "java")
      fs.writeFileSync(path.join(jobDir, "Main.java"), code);
    else if (language == "cpp")
      fs.writeFileSync(path.join(jobDir, "main.cpp"), code);

    // folder z zapisanym plikiem
    const mountArg =
      process.platform === "win32"
        ? `${jobDir.replace(/\\/g, "/")}:/app`
        : `${jobDir}:/app`;

    const containerName = `job-${jobId}`;

    // uruchamiamy kontener z danym srodowiskiem
    var code_process;
    if (language == "python") {
      code_process = spawn("docker", [
        "run",
        "--rm",
        "--name", containerName,

        "--network", "none",             // brak internetu
        "--memory", memorylimit,         // limit RAM
        "--cpus", cpuslimit,             // limit CPU

        "--security-opt", securityopt,
        "--pids-limit", pidslimit,
        "--read-only",

        "-i", // bedziemy wpisywac input

        "-v", mountArg,                  

        "runcode-python"                 // nazwa image dockera
      ]);
    }
    else if (language == "java") {
      code_process = spawn("docker", [
        "run",
        "--rm",
        "--name", containerName,

        "--network", "none",             // brak internetu
        "--memory", "256m",              // limit RAM
        "--cpus", cpuslimit,             // limit CPU

        "--security-opt", securityopt,
        "--pids-limit", pidslimit,
        "--read-only",

        "-i", // bedziemy wpisywac input

        "-v", mountArg,                  

        "runcode-java"                   // nazwa image dockera
      ]);
    }
    else if (language == "cpp") {
      code_process = spawn("docker", [
        "run",
        "--rm",
        "--name", containerName,

        "--network", "none",             // brak internetu
        "--memory", "256m",              // limit RAM
        "--cpus", cpuslimit,             // limit CPU

        "--security-opt", securityopt,
        "--pids-limit", pidslimit,
        "--read-only",

        "-i", // bedziemy wpisywac input

        "-v", mountArg,                  // folder z plikiem, z którego czytamy

        "runcode-cpp"                   // nazwa image dockera
      ]);
    }

    // wpisujemy do programu wygenerowane dane wejsciowe do zadania
    let exercise_input = "";
    let exercise_output = "";
    
    if (exercise) {
      let exercise_io = exercise.generateInputOutput();
      exercise_input = (exercise_io.args);
      exercise_output = exercise_io.expected;
      code_process.stdin.write(exercise_input);
      code_process.stdin.end();
      //console.log("Input:", JSON.stringify(exercise_input));
    }

    // ustawiamy timeout
    const timeout = setTimeout(() => {
      spawn("docker", ["kill", containerName]); 
      cleanupJobDir(jobDir);
      finish({
        stdout,
        stderr: "Timeout",
        returncode: -1
      });
    }, 6000); // 6 sekund

    // co program wypisuje do konsoli
    code_process.stdout.on("data", (data) => {
      //console.log("RAW STDOUT:", JSON.stringify(data.toString()));
      stdout += data.toString();

      // zbyt duzy stdout
      if (stdout.length > MAX_STDOUT) {
        cleanupJobDir(jobDir);
        spawn("docker", ["kill", containerName]);
        finish({
          stdout: " ",
          stderr: "stdout too long",
          returncode: -1
        });
      }
    });

    stdout = ""

    // bledy wypisywane przez program
    code_process.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    // blad z uruchomieniem
    code_process.on("error", (err) => {
      cleanupJobDir(jobDir);
      finish({
        stdout: "",
        stderr: `Failed to start Docker: ${err.message}`,
        returncode: -1
      });
    });

    // zamkniecie procesu -> zwracamy wynik do uzytkownika
    code_process.on("close", (exitCode) => {
      // porownujemy stdout z tym co powinno wyjsc w zadaniu
      if (exercise) {
        solved = (stdout.trim() === exercise_output.trim());

        if (solved) {
          console.log("Udalo sie!");
        }
        else {
          console.log("Nie udalo sie.");
        }
      }

      cleanupJobDir(jobDir); 
      if (exerciseid) {
        finish({ stdout, stderr, exitCode, exercise_input, exercise_output });
      }
      else {
        finish({ stdout, stderr, exitCode });
      }
      return;
    });
  }
  else {
    finish({stdout, stderr, returncode: -1});
  }
  return;
})

/* ======== cwiczenia ======== */

// lista cwiczen
app.get("/exercises", (req, res) => {
  const list = Object.values(exercises).map((ex) => ({
    id: ex.id,
    title: ex.title,
    difficulty: ex.difficulty,
    description: ex.description
  }));

  res.json(list);
});

// pojedyncze zadanie
app.get("/exercises/:id", (req, res) => {
  const exercise = exercises[req.params.id];

  if (!exercise) {
    return res.status(404).json({ message: "Zadania nie znaleziono" });
  }

  res.json({
    id: exercise.id,
    title: exercise.title,
    difficulty: exercise.difficulty,
    description: exercise.description,
    description: exercise.longdescription
  });
});


app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});