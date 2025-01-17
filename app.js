const express = require("express");
const bodyParser = require("body-parser");
const { Client } = require("ssh2");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

let sshConnection;

// Render the form to input IP, username, and password
app.get("/", (req, res) => {
    res.render("form");
});

// Handle form submission and establish SSH connection
app.post("/connect", (req, res) => {
    //const { ip, username, password } = req.body;
    console.log("this "+ req.body.serverinfo);
    const  serverinfo  = req.body.serverinfo;
    const arrdata = serverinfo.split('|')
    const ip = arrdata[0];
    const username = arrdata[1];
    const password = arrdata[2];

    sshConnection = new Client();

    sshConnection
        .on("ready", () => {
            console.log("SSH Connection Established");
            res.redirect(`/terminal?ip=${ip}`);
        })
        .on("error", (err) => {
            console.error("SSH Connection Error:", err);
            res.send("Failed to connect. Please check the details and try again.");
        })
        .connect({
            host: ip,
            port: 22, // Default SSH port
            username: username,
            password: password,
        });
});

// Render the terminal page
app.get("/terminal", (req, res) => {
    if (!sshConnection) {
        return res.redirect("/");
    }
    res.render("terminal");
});

// Handle WebSocket connection for terminal
io.on("connection", (socket) => {
    console.log("WebSocket connection established");

    if (!sshConnection) {
        socket.emit("output", "No active SSH connection.");
        return;
    }

    sshConnection.shell((err, stream) => {
        if (err) {
            socket.emit("output", `Error: ${err.message}`);
            return;
        }

        // Send terminal output to client
        stream.on("data", (data) => {
            socket.emit("output", data.toString());
        });

        stream.stderr.on("data", (data) => {
            socket.emit("output", data.toString());
        });

        // Receive terminal input from client
        socket.on("input", (input) => {
            stream.write(input);
        });

        socket.on("disconnect", () => {
            console.log("WebSocket connection closed");
            stream.end();
        });
    });
});

// Start the server
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
