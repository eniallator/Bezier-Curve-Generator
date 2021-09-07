const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const mouse = new Mouse(canvas);
const paramConfig = new ParamConfig(
  "./config.json",
  window.location.search,
  $("#cfg-outer")
);
paramConfig.addCopyToClipboardHandler("#share-btn");

window.onresize = (evt) => {
  canvas.width = $("#canvas").width();
  canvas.height = $("#canvas").height();
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

  span.ondrag = span.ondragend = (evt) => {
    if (evt.clientX && evt.clientY) {
      spanPos.setHead(
        clamp(
          evt.clientX,
          span.offsetWidth / 2,
          canvas.width - span.offsetWidth / 2
        ),
        clamp(
          evt.clientY,
          span.offsetHeight / 2,
          canvas.height - span.offsetHeight / 2
        )
      );
      span.style.left = `${clamp(
        evt.clientX - span.offsetWidth / 2,
        0,
        canvas.width - span.offsetWidth
      )}px`;
      span.style.top = `${clamp(
        evt.clientY - span.offsetHeight / 2,
        0,
        canvas.height - span.offsetHeight
      )}px`;
      updateBezierPointDistances();
      draw();
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

function draw() {
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const precision = paramConfig.getVal("precision");
  const curvePoints = new Array(precision)
    .fill()
    .map((_, i) => bezierCurve(bezierPoints, i / precision));

  curvePoints.push(bezierPoints[bezierPoints.length - 1].pt);

  const fullDist = bezierPoints.reduce((acc, item) => acc + item.distToNext, 0);

  let currBezierPointsIndex = 0;
  let nextAccBezierDist = 0;
  let accBezierDist = 0;

  for (let i = 0; i < curvePoints.length; i++) {
    const percent = i / curvePoints.length;
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

  ctx.strokeStyle = "white";
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

  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i in curvePoints) {
    const pt = curvePoints[i];
    if (i === "0") {
      ctx.moveTo(pt.x, pt.y);
    } else {
      ctx.lineTo(pt.x, pt.y);
    }
  }
  ctx.stroke();
}

function init() {
  for (let span of $("#bezier-points span")) {
    initSpanDragEvents(span);
  }

  paramConfig.addListener(
    (state) => {
      const n = state["num-bezier-points"];
      if (n === bezierPoints.length) return;

      if (n > bezierPoints.length) {
        for (let i = bezierPoints.length - 1; i < n - 1; i++) {
          $("#points-between").append(
            `<span draggable="true" style="top: 10%; left: 50%;" data-index="${i}"></span>`
          );
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
    },
    ["num-bezier-points"]
  );

  paramConfig.addListener(() => draw());

  paramConfig.tellListeners(true);

  updateBezierPointDistances();
  draw();
}

paramConfig.onLoad(init);
