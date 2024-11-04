// Import Colyseus (make sure you include the Colyseus client script in your HTML file)

// Import Colyseus (make sure you include the Colyseus client script in your HTML file)

// Colyseus Client Setup
const Colyseus = window.Colyseus;
const client = new Colyseus.Client("wss://shapegame.onrender.com"); // Colyseus server address

// Global Variables
var canvas = document.getElementById("myCanvas");
var engine = new BABYLON.Engine(canvas, true);
var scene = new BABYLON.Scene(engine);

// Add instructions to the page
const instructionsDiv = document.createElement("div");
instructionsDiv.innerHTML = `
  <h2>How to Use the App</h2> 
  <ul>
     <li>This is a multiplayer environment where you and other users can see each other's shapes in real time.</li>
    <li><b>To draw a shape:</b> Enable draw mode and left-click on the canvas to place points.</li>
    <li><b>To create a 3D shape:</b> Right-click after drawing a closed shape to extrude it.</li>
    <li><b>To move a shape:</b> Select "Move" mode, click on a 3D shape, and drag it across the plane.</li>
    <li><b>Interaction:</b> Your shapes will be visible to other users, and vice versa, in real time.</li>
  </ul>
`;
instructionsDiv.style.fontSize = "16px";
instructionsDiv.style.marginBottom = "0px";
instructionsDiv.style.padding = "10px";
instructionsDiv.style.backgroundColor = "#f0f0f0";
instructionsDiv.style.border = "1px solid #ccc";

document.body.insertBefore(instructionsDiv, canvas);

const buttonContainer = document.createElement("div");
buttonContainer.style.marginBottom = "0px";

const drawButton = document.createElement("button");
drawButton.textContent = "Draw";
drawButton.style.fontSize = "20px";
drawButton.onclick = enterDrawMode;
buttonContainer.appendChild(drawButton);

const moveButton = document.createElement("button");
moveButton.textContent = "Move";
moveButton.style.fontSize = "20px";
moveButton.onclick = enterMoveMode;
buttonContainer.appendChild(moveButton);

document.body.insertBefore(buttonContainer, canvas);

const camera = new BABYLON.ArcRotateCamera(
  "Camera",
  0,
  Math.PI / 3,
  30,
  BABYLON.Vector3.Zero(),
  scene
);
camera.attachControl(canvas, true);

var drawMode = false;
var moveMode = false;
var vertexEditMode = false;

var points = [];
var shapesToExtrude = [];
var room;

scene.clearColor = new BABYLON.Color3(1, 1, 1);

const ground = BABYLON.MeshBuilder.CreateGround(
  "ground",
  { width: 15, height: 35 },
  scene
);
const groundMaterial = new BABYLON.GridMaterial("groundMaterial", scene);
groundMaterial.lineColor = new BABYLON.Color3(1, 0, 0);
groundMaterial.mainColor = new BABYLON.Color3(0, 0, 0);
ground.material = groundMaterial;
ground.enableEdgesRendering();
ground.edgesWidth = 4.0;
ground.edgesColor = new BABYLON.Color4(0, 0, 0, 1);

// Colyseus room initialization

client.joinOrCreate("shape_room").then((joinedRoom) => {
  room = joinedRoom;

  // Receive initial shapes from the server
  room.onMessage("initShapes", (shapes) => {
    shapes.forEach((shape) => renderShape(shape));
  });

  // Listen for new shapes created by other players
  room.onMessage("createShape", (data) => renderShape(data));

  // Listen for movement updates from other players
  room.onMessage("moveShape", (data) => {
    const shape = scene.getMeshByID(data.shapeId);
    if (shape) {
      // Optional: Implementing interpolation for smooth movement
      BABYLON.Animation.CreateAndStartAnimation(
        "shapeMove",
        shape,
        "position",
        30,
        5,
        shape.position,
        new BABYLON.Vector3(data.x, data.y, data.z),
        BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
      );
    }
  });

  // Listen for remove shapes messages from other players
  room.onMessage("removeShapesByClient", (data) => {
    const { clientId } = data;
    shapesToExtrude = shapesToExtrude.filter((shape, idx) => {
      const shapeMesh = scene.getMeshByID("shapeExtruded" + idx);
      if (shape.clientId === clientId && shapeMesh) {
        shapeMesh.dispose();
        return false;
      }
      return true;
    });
  });
});

function enterDrawMode() {
  drawMode = true;
  moveMode = false;
  vertexEditMode = false;
}

// Render a shape received from Colyseus

function renderShape(data) {
  const shape = data.shapeData.map((p) => new BABYLON.Vector3(p.x, p.y, p.z));
  const shapeId = data.shapeId || "shapeExtruded" + shapesToExtrude.length;

  if (data.extruded) {
    // Create the extruded shape
    const extrusion = BABYLON.MeshBuilder.ExtrudePolygon(
      shapeId,
      { shape: shape, depth: data.depth },
      scene
    );
    extrusion.position.y = 5;
    extrusion.id = shapeId; // Ensure unique ID
    const material = new BABYLON.StandardMaterial("extrudedMaterial", scene);
    material.emissiveColor = new BABYLON.Color3(1, 1, 0); // Bright yellow
    extrusion.material = material;
    extrusion.enableEdgesRendering();
    extrusion.edgesWidth = 4.0;
    extrusion.edgesColor = new BABYLON.Color4(0, 0, 0, 1);
  } else {
    // Create the 2D shape lines if not extruded
    const lines = BABYLON.MeshBuilder.CreateLines(
      "lines" + shapesToExtrude.length,
      { points: shape },
      scene
    );
    lines.color = new BABYLON.Color3(1, 0, 0);
  }

  shapesToExtrude.push(shape);
}

// Step 2: Draw a 2D shape
scene.onPointerObservable.add(handlePointer);

function handlePointer(pointerInfo) {
  if (drawMode) {
    var pickInfo = pointerInfo.pickInfo;
    switch (pointerInfo.type) {
      case BABYLON.PointerEventTypes.POINTERDOWN:
        if (
          pointerInfo.event.inputIndex == 2 &&
          pickInfo.pickedMesh &&
          (pickInfo.pickedMesh.id === "ground" ||
            pickInfo.pickedMesh.id === "lines")
        ) {
          points.push(pickInfo.pickedPoint);
          drawPointMarker(pickInfo.pickedPoint);
        } else if (pointerInfo.event.inputIndex == 4) {
          points.push(points[0]);
          const shapeData = points.map((p) => ({ x: p.x, y: p.y, z: p.z }));
          room.send("createShape", { shapeData });
          renderShape({ shapeData });
          points = [];
        }
        break;

      // Check if a 3D shape is clicked for moving
      case BABYLON.PointerEventTypes.POINTERDOWN:
        if (
          moveMode &&
          pickInfo.pickedMesh &&
          pickInfo.pickedMesh.id.startsWith("shapeExtruded")
        ) {
          currentMesh = pickInfo.pickedMesh;
          startingPoint = getGroundPosition(pointerInfo.event);
          if (startingPoint) {
            setTimeout(() => camera.detachControl(canvas), 0);
          }
        }
        break;
    }
  }
}

function drawPointMarker(point) {
  var curShapeNumber = shapesToExtrude.length;
  var curSphereWithinShape = points.length - 1;
  var sphere = BABYLON.MeshBuilder.CreateSphere(
    "pointMarker" + curShapeNumber + "_" + curSphereWithinShape,
    { diameter: 0.5 },
    scene
  );
  sphere.position = point;

  var material = new BABYLON.StandardMaterial("pointMarkerMaterial", scene);
  material.emissiveColor = new BABYLON.Color3(1, 1, 1);
  sphere.material = material;
}

// Step 3: 2D-Shape Extrusion
var shapesExtruded = [];

function extrudeShape() {
  drawMode = false;
  moveMode = false;
  vertexEditMode = false;
  extrudeMode = true;

  for (let i = 0; i < shapesToExtrude.length; i++) {
    if (i == shapesExtruded.length) {
      shapesExtruded.push(false);
    }

    if (shapesExtruded[i] == false) {
      // Extruding shape with constant height = 5
      var extrudedShapeUniqueId = "shapeExtruded" + i.toString();
      const extrusion = BABYLON.MeshBuilder.ExtrudePolygon(
        extrudedShapeUniqueId,
        { shape: shapesToExtrude[i], depth: 5, updatable: true },
        scene
      );
      extrusion.position.y = 5;

      // Extruded shape UI Enhancements
      var material = new BABYLON.StandardMaterial("extrudedMaterial", scene);
      material.emissiveColor = new BABYLON.Color3(0, 128, 128);
      extrusion.material = material;
      extrusion.enableEdgesRendering();
      extrusion.edgesWidth = 4.0;
      extrusion.edgesColor = new BABYLON.Color4(0, 0, 0, 1);

      // Marking as shape extruded
      shapesExtruded[i] = true;

      // Send extrusion data to the server
      room.send("extrudeShape", {
        shapeId: extrudedShapeUniqueId,
        shapeData: shapesToExtrude[i],
        depth: 5,
      });
    }
  }
}

// Step 4: Move/Edit the extruded shape
function enterMoveMode() {
  moveMode = true;
  drawMode = false;
  vertexEditMode = false;

  runMoveMode();
}

function runMoveMode() {
  var canvas = engine.getRenderingCanvas();
  var startingPoint;
  var currentMesh = null;

  // Helper function to get the position on the ground
  var getGroundPosition = function () {
    var pickinfo = scene.pick(
      scene.pointerX,
      scene.pointerY,
      (mesh) => mesh === ground
    );
    return pickinfo.hit ? pickinfo.pickedPoint : null;
  };

  // Start dragging the shape
  var onPointerDownDrag = function (evt) {
    if (!moveMode) return;

    var pickInfo = scene.pick(scene.pointerX, scene.pointerY, (mesh) => {
      console.log("Mesh ID:", mesh ? mesh.id : "undefined");
      // Check for shapes with IDs starting with "shapeExtruded" or "shape-" for movement
      return (
        mesh !== ground &&
        mesh.id &&
        (mesh.id.startsWith("shapeExtruded") || mesh.id.startsWith("shape-"))
      );
    });

    // Check if we hit a valid mesh
    if (pickInfo.hit && pickInfo.pickedMesh) {
      currentMesh = pickInfo.pickedMesh;

      startingPoint = getGroundPosition();

      if (startingPoint) {
        console.log("Shape selected for dragging:", currentMesh.id);
        camera.detachControl(canvas); // Disable camera control for dragging
      } else {
        console.log("Starting point not detected on the ground");
      }
    } else {
      console.log("No shape was selected on pointer down or invalid mesh.");
    }
  };

  // Stop dragging and re-enable camera control
  var onPointerUpDrag = function () {
    if (startingPoint && currentMesh) {
      console.log("Shape dropped:", currentMesh.id);
      camera.attachControl(canvas, true); // Re-enable camera control
      startingPoint = null;
      currentMesh = null;
    }
  };

  // Move the shape along with the pointer

  function onPointerMoveDrag(evt) {
    if (!startingPoint || !currentMesh) return;

    var current = getGroundPosition();
    if (!current) return;

    var diff = current.subtract(startingPoint);
    currentMesh.position.addInPlace(diff); // Update shape position

    // Broadcast movement to Colyseus
    room.send("moveShape", {
      shapeId: currentMesh.id,
      x: currentMesh.position.x,
      y: currentMesh.position.y,
      z: currentMesh.position.z,
    });

    startingPoint = current; // Update starting point for smooth dragging
  }

  // Attach event listeners for dragging
  canvas.addEventListener("pointerdown", onPointerDownDrag, false);
  canvas.addEventListener("pointerup", onPointerUpDrag, false);
  canvas.addEventListener("pointermove", onPointerMoveDrag, false);
}

// Step 5: Edit the vertex Position
function enterVertexEditMode() {
  vertexEditMode = true;
  moveMode = false;
  drawMode = false;
  runVertexEditMode();
}

function runVertexEditMode() {
  var canvas = engine.getRenderingCanvas();
  var startingPoint;
  var currentMesh;
  var currentMeshNonSphere;

  var isVertex = function () {
    var ray = scene.createPickingRay(
      scene.pointerX,
      scene.pointerY,
      BABYLON.Matrix.Identity(),
      camera
    );
    var rayCastHit = scene.pickWithRay(ray);
    var origin = rayCastHit.pickedPoint;
    var direction = new BABYLON.Vector3(0, -1, 0);
    var length = 5;
    var rayPerpedicular = new BABYLON.Ray(origin, direction, length);
    var hits = scene.multiPickWithRay(rayPerpedicular);
    return (
      hits && hits.some((hit) => hit.pickedMesh.name.startsWith("pointMarker"))
    );
  };

  var getGroundPosition = function () {
    var pickinfo = scene.pick(scene.pointerX, scene.pointerY, function (mesh) {
      return mesh == ground;
    });
    if (pickinfo.hit) return pickinfo.pickedPoint;
    return null;
  };

  var onPointerDown = function (evt) {
    if (evt.button !== 0) return;

    var pickInfo = scene.pick(scene.pointerX, scene.pointerY, function (mesh) {
      return (
        mesh !== ground &&
        (mesh.id.startsWith("pointMarker") ||
          (mesh.id.startsWith("shapeExtruded") && isVertex()))
      );
    });
    if (pickInfo.hit) {
      currentMesh = pickInfo.pickedMesh;
      startingPoint = getGroundPosition();
      if (startingPoint) camera.detachControl(canvas);
    }
  };

  var onPointerUp = function () {
    if (startingPoint) {
      camera.attachControl(canvas, true);
      startingPoint = null;
    }
  };

  var onPointerMove = function (evt) {
    if (!startingPoint) return;

    var current = getGroundPosition();
    if (!current) return;

    var diff = current.subtract(startingPoint);
    currentMesh.position.addInPlace(diff);

    var curMeshIdxs = currentMesh.id.split("_");
    var lineMeshId = "lines" + curMeshIdxs[0].slice(11);
    var lineMesh = scene.getMeshByID(lineMeshId);
    if (lineMesh) {
      var positions = lineMesh.getVerticesData(
        BABYLON.VertexBuffer.PositionKind
      );
      var startIdx = 3 * Number(curMeshIdxs[1]);
      positions[startIdx] = currentMesh.position.x;
      positions[startIdx + 1] = currentMesh.position.y;
      positions[startIdx + 2] = currentMesh.position.z;
      lineMesh.setVerticesData(BABYLON.VertexBuffer.PositionKind, positions);
    }
    startingPoint = current;
  };

  canvas.addEventListener("pointerdown", onPointerDown, false);
  canvas.addEventListener("pointerup", onPointerUp, false);
  canvas.addEventListener("pointermove", onPointerMove, false);
}

// Run the app
engine.runRenderLoop(function () {
  scene.render();
});
