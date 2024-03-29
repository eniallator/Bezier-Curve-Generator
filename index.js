const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const mouse = new Mouse(canvas);
const paramConfig = new ParamConfig(
  "./config.json",
  window.location.search,
  $("#cfg-outer"),
  true
);

const initialPositions = paramConfig.extra
  ? [...paramConfig.extra].map((strNum) => base64ToPosInt(strNum) / 64)
  : [];
let initializing = true;

paramConfig.addCopyToClipboardHandler("#share-btn", () =>
  bezierPoints.reduce(
    (acc, item, i) =>
      acc +
      intToBase64(
        Math.floor(
          (item.pt.x - $("#bezier-points span")[i].offsetWidth / 2) /
            (canvas.width / 64)
        )
      ) +
      intToBase64(
        Math.floor(
          (item.pt.y - $("#bezier-points span")[i].offsetHeight / 2) /
            (canvas.height / 64)
        )
      ),
    ""
  )
);

window.onresize = (evt) => {
  const oldDim = new Vector(canvas.width, canvas.height);
  canvas.width = $("#canvas").width();
  canvas.height = $("#canvas").height();
  const scaleFactor = new Vector(canvas.width, canvas.height).divide(oldDim);
  if (!initializing) {
    bezierPoints.forEach((item) => item.pt.multiply(scaleFactor));
    const spans = $("#bezier-points span");
    for (let i = 0; i < spans.length; i++) {
      spans[i].style.left =
        bezierPoints[i].pt.x - spans[i].offsetWidth / 2 + "px";
      spans[i].style.top =
        bezierPoints[i].pt.y - spans[i].offsetHeight / 2 + "px";
    }
    needsUpdating = true;
    draw();
  }
};
window.onresize();

ctx.fillStyle = "black";

const bezierPoints = [];
const updateBezierPointDistances = () =>
  bezierPoints.forEach(
    (item, i) =>
      (item.distToNext =
        i < bezierPoints.length - 1
          ? bezierPoints[i + 1].pt.copy().sub(item.pt).getMagnitude()
          : null)
  );

function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

function initSpanDragEvents(span, index) {
  const spanPos = new Vector(
    span.offsetLeft + span.offsetWidth / 2,
    span.offsetTop + span.offsetHeight / 2
  );

  const updateSpanPos = (x, y) => {
    const oldPos = spanPos.copy();
    spanPos.setHead(
      clamp(x, span.offsetWidth / 2, canvas.width - span.offsetWidth / 2),
      clamp(y, span.offsetHeight / 2, canvas.height - span.offsetHeight / 2)
    );
    span.style.left = `${spanPos.x - span.offsetWidth / 2}px`;
    span.style.top = `${spanPos.y - span.offsetHeight / 2}px`;
    updateBezierPointDistances();
    if (!oldPos.equals(spanPos)) {
      needsUpdating = true;
      if (
        !paramConfig.getVal("dynamic-precision") ||
        numPopulatedPoints == paramConfig.getVal("precision")
      ) {
        draw();
      }
    }
  };

  span.ondragend = span.ontouchend = (evt) => {
    if (evt.clientX && evt.clientY) {
      updateSpanPos(evt.clientX, evt.clientY);
    }
  };
  span.ondrag = (evt) => {
    if (
      !paramConfig.getVal("update-when-dropped") &&
      evt.clientX &&
      evt.clientY
    ) {
      updateSpanPos(evt.clientX, evt.clientY);
    }
  };

  span.ontouchmove = (evt) => {
    if (
      !paramConfig.getVal("update-when-dropped") &&
      evt.touches[0].clientX &&
      evt.touches[0].clientY
    ) {
      updateSpanPos(evt.touches[0].clientX, evt.touches[0].clientY);
    }
  };

  if (index === undefined) {
    bezierPoints.push({ pt: spanPos });
  } else {
    bezierPoints.splice(index, 0, { pt: spanPos });
  }
}

// https://en.wikipedia.org/wiki/De_Casteljau%27s_algorithm
function bezierCurve(points, t) {
  const n = points.length;

  const beta = points.map((bezierItem) => bezierItem.pt.copy());
  for (let j = 0; j < n; j++) {
    for (let k = 0; k < n - j - 1; k++) {
      beta[k].multiply(1 - t).add(beta[k + 1].copy().multiply(t));
    }
  }

  return beta[0];
}

let needsUpdating = true;

let curvePoints;
const numPopulatedPointsPerIteration = 50;
let numPopulatedPoints = 0;

function draw() {
  const precision = paramConfig.getVal("precision");
  let indicesUpdated;

  if (paramConfig.getVal("dynamic-precision")) {
    if (needsUpdating) {
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      needsUpdating = false;
      numPopulatedPoints = 0;
      curvePoints = new Array(precision).fill();
      curvePoints.push(bezierPoints[bezierPoints.length - 1].pt);
    }
    const numPointsToPopulate = Math.min(
      numPopulatedPointsPerIteration,
      precision - numPopulatedPoints
    );
    const pointsUpdated = new Array(numPointsToPopulate)
      .fill()
      .map((_, i) =>
        Math.floor((precision - (numPopulatedPoints + i)) * Math.random())
      )
      .sort((a, b) => a - b);
    indicesUpdated = new Array(numPointsToPopulate).fill();
    numPopulatedPoints += numPointsToPopulate;
    let j = 0;
    let k = 0;
    for (let i = 0; i < numPointsToPopulate; i++) {
      while (curvePoints[j] !== undefined || k < pointsUpdated[i]) {
        j++;
        k += curvePoints[j] === undefined;
      }
      curvePoints[j] = bezierCurve(bezierPoints, j / precision);
      indicesUpdated[i] = j;
    }
  } else {
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    curvePoints = new Array(precision)
      .fill()
      .map((_, i) => bezierCurve(bezierPoints, i / precision));
    curvePoints.push(bezierPoints[bezierPoints.length - 1].pt);
  }

  if (paramConfig.getVal("draw-rainbow-lines")) {
    const fullDist = bezierPoints.reduce(
      (acc, item) => acc + item.distToNext,
      0
    );
    let currBezierPointsIndex = 0;
    let nextAccBezierDist = 0;
    let accBezierDist = 0;

    ctx.lineWidth = 2;
    const iterations = paramConfig.getVal("dynamic-precision")
      ? indicesUpdated.length
      : precision;
    for (let j = 0; j < iterations; j++) {
      const i = paramConfig.getVal("dynamic-precision") ? indicesUpdated[j] : j;
      if (curvePoints[i] === undefined) continue;
      const percent = i / precision;
      const currDist = percent * fullDist;
      let lastPoint = false;
      while (nextAccBezierDist < currDist && !lastPoint) {
        accBezierDist = nextAccBezierDist;
        nextAccBezierDist += bezierPoints[currBezierPointsIndex].distToNext;
        if (bezierPoints[currBezierPointsIndex].distToNext === null) {
          lastPoint = true;
        } else {
          currBezierPointsIndex++;
        }
      }

      let pointBetweenBezierPoints;
      if (currBezierPointsIndex === 0 || lastPoint) {
        pointBetweenBezierPoints = bezierPoints[currBezierPointsIndex].pt;
      } else {
        pointBetweenBezierPoints = bezierPoints[
          currBezierPointsIndex - 1
        ].pt.lerp(
          bezierPoints[currBezierPointsIndex].pt,
          (currDist - accBezierDist) / (nextAccBezierDist - accBezierDist)
        );
      }

      ctx.strokeStyle = `hsl(${percent * 360}, 100%, 50%)`;
      ctx.beginPath();
      ctx.moveTo(curvePoints[i].x, curvePoints[i].y);
      ctx.lineTo(pointBetweenBezierPoints.x, pointBetweenBezierPoints.y);
      ctx.stroke();
    }
  }

  ctx.strokeStyle = "white";
  if (
    paramConfig.getVal("draw-lines-between-points") &&
    (!paramConfig.getVal("dynamic-precision") ||
      numPopulatedPoints === precision)
  ) {
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = bezierPoints.length - 1; i >= 0; i--) {
      const pt = bezierPoints[i].pt;
      if (i === bezierPoints.length - 1) {
        ctx.moveTo(pt.x, pt.y);
      } else {
        ctx.lineTo(pt.x, pt.y);
      }
    }
    ctx.stroke();
  }

  if (
    paramConfig.getVal("draw-bezier-curve") &&
    (!paramConfig.getVal("dynamic-precision") ||
      numPopulatedPoints === precision)
  ) {
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i in curvePoints) {
      if (curvePoints[i] === undefined) continue;
      const pt = curvePoints[i];
      if (i === "0") {
        ctx.moveTo(pt.x, pt.y);
      } else {
        ctx.lineTo(pt.x, pt.y);
      }
    }
    ctx.stroke();
  }

  if (
    paramConfig.getVal("dynamic-precision") &&
    numPopulatedPoints < precision
  ) {
    requestAnimationFrame(draw);
  }
}

function init() {
  const endSpans = $("#bezier-points span");
  for (let i = 0; i < endSpans.length; i++) {
    const extraIndex = 2 * i * (paramConfig.getVal("num-bezier-points") - 1);
    const span = endSpans[i];
    if (extraIndex + 1 < initialPositions.length) {
      span.style.left = isNaN(initialPositions[extraIndex])
        ? span.style.left
        : canvas.width * initialPositions[extraIndex] + "px";
      span.style.top = isNaN(initialPositions[extraIndex])
        ? span.style.top
        : canvas.height * initialPositions[extraIndex + 1] + "px";
    }
    initSpanDragEvents(span);
  }

  paramConfig.addListener(
    (state) => {
      const n = state["num-bezier-points"];
      if (n === bezierPoints.length) return;

      if (n > bezierPoints.length) {
        for (let i = bezierPoints.length - 1; i < n - 1; i++) {
          if (initializing && 2 * i + 1 < initialPositions.length) {
            $("#points-between").append(
              `<span draggable="true" style="left: ${
                isNaN(initialPositions[2 * i])
                  ? "50%"
                  : canvas.width * initialPositions[2 * i] + "px"
              }; top: ${
                isNaN(initialPositions[2 * i + 1])
                  ? "50%"
                  : canvas.height * initialPositions[2 * i + 1] + "px"
              };" data-index="${i}"></span>`
            );
          } else {
            $("#points-between").append(
              `<span draggable="true" style="left: 50%; top: 10%;" data-index="${i}"></span>`
            );
          }
          initSpanDragEvents(
            $(`#points-between span[data-index="${i}"]`)[0],
            i
          );
        }
      } else {
        for (let i = bezierPoints.length - 2; i >= n - 1; i--) {
          $(`#points-between span[data-index="${i}"]`).remove();
          bezierPoints.splice(i, 1);
        }
      }
      needsUpdating = true;
      draw();
    },
    ["num-bezier-points"]
  );

  paramConfig.addListener(() => {
    needsUpdating = true;
    draw();
  });

  paramConfig.tellListeners(true);

  initializing = false;

  updateBezierPointDistances();
  needsUpdating = true;
  draw();
}

paramConfig.onLoad(init);
