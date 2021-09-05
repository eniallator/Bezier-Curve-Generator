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
ctx.strokeStyle = "white";
ctx.lineWidth = 3;

const bezierPoints = [];

function clamp(val, min, max) {
  return Math.max(Math.min(val, max), min);
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
    }
  };
  if (index === undefined) {
    bezierPoints.push(spanPos);
  } else {
    bezierPoints.splice(index, 0, spanPos);
  }
}

// https://en.wikipedia.org/wiki/De_Casteljau%27s_algorithm
function bezierCurve(points, t) {
  const n = points.length;

  const beta = points.map((pt) => pt.copy());
  for (let j = 0; j < n; j++) {
    for (let k = 0; k < n - j - 1; k++) {
      beta[k].multiply(1 - t).add(beta[k + 1].copy().multiply(t));
    }
  }

  return beta[0];
}

function run() {
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const numCurvePoints = paramConfig.getVal("precision");
  const curvePoints = new Array(numCurvePoints)
    .fill()
    .map((_, i) => bezierCurve(bezierPoints, i / numCurvePoints));

  curvePoints.push(bezierPoints[bezierPoints.length - 1]);

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

  requestAnimationFrame(run);
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

  run();
}

paramConfig.onLoad(init);
