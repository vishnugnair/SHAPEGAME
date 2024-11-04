const express = require("express");
const path = require("path");
const http = require("http");
const { Server } = require("colyseus");
const { Room } = require("colyseus");

// Create Express app and HTTP server
const app = express();
const server = http.createServer(app);

// Set up Colyseus server
const gameServer = new Server({
  server,
});

// Serve static files (index.html and app.js)
app.use(express.static(path.join(__dirname)));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Define a Room for players
class ShapeRoom extends Room {
  onCreate(options) {
    this.shapes = []; // To store shapes

    this.onMessage("createShape", (client, data) => {
      const shape = {
        clientId: client.sessionId,
        extruded: true,
        depth: 5,
        ...data,
      };
      this.shapes.push(shape);

      this.broadcast("createShape", shape); // Broadcast new shape
    });

    this.onMessage("moveShape", (client, data) => {
      const { shapeId, x, y, z } = data;

      // Update shape position in server's state (optional but useful for tracking positions)
      const shape = this.shapes.find((shape) => shape.shapeId === shapeId);
      if (shape) {
        shape.position = { x, y, z };
      }

      // Broadcast the movement to all connected clients
      this.broadcast("moveShape", { shapeId, x, y, z });
    });

    this.onMessage("extrudeShape", (client, data) => {
      const { shapeId, shapeData, depth } = data;
      const existingShape = this.shapes.find(
        (shape) => shape.shapeId === shapeId
      );
      if (existingShape) {
        existingShape.extruded = true;
        existingShape.depth = depth;
        existingShape.shapeData = shapeData;
      }
      this.broadcast("extrudeShape", {
        shapeId,
        shapeData,
        extruded: true,
        depth,
      });
    });

    // Clear shapes created by a client upon receiving "clearShapes" message
    this.onMessage("moveShape", (client, data) => {
      const { shapeId, x, y, z } = data;

      // Optional: Update shape position in server's state for tracking positions
      const shape = this.shapes.find((shape) => shape.shapeId === shapeId);
      if (shape) {
        shape.position = { x, y, z };
      }

      // Broadcast the movement to all connected clients
      this.broadcast("moveShape", { shapeId, x, y, z });
    });
  }

  onJoin(client) {
    console.log("Client joined:", client.sessionId);
    client.send("initShapes", this.shapes);
  }
}

// Register the room on the Colyseus server
gameServer.define("shape_room", ShapeRoom);

// Start the server
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
