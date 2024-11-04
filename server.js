const express = require("express");
const path = require("path");
const http = require("http");
const { Server } = require("colyseus");
const { Room } = require("colyseus");

const app = express();
const server = http.createServer(app);

const gameServer = new Server({
  server,
});

app.use(express.static(path.join(__dirname)));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

class ShapeRoom extends Room {
  onCreate(options) {
    this.shapes = [];

    this.onMessage("createShape", (client, data) => {
      const shape = {
        clientId: client.sessionId,
        extruded: true,
        depth: 5,
        ...data,
      };
      this.shapes.push(shape);

      this.broadcast("createShape", shape);
    });

    this.onMessage("moveShape", (client, data) => {
      const { shapeId, x, y, z } = data;

      const shape = this.shapes.find((shape) => shape.shapeId === shapeId);
      if (shape) {
        shape.position = { x, y, z };
      }

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

    this.onMessage("moveShape", (client, data) => {
      const { shapeId, x, y, z } = data;

      const shape = this.shapes.find((shape) => shape.shapeId === shapeId);
      if (shape) {
        shape.position = { x, y, z };
      }

      this.broadcast("moveShape", { shapeId, x, y, z });
    });
  }

  onJoin(client) {
    console.log("Client joined:", client.sessionId);
    client.send("initShapes", this.shapes);
  }
}

gameServer.define("shape_room", ShapeRoom);

const PORT = process.env.port || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
