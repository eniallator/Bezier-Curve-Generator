class Mouse {
  #down;
  #clicked;
  #pos;
  #relativePos;

  constructor(element) {
    this.#down = false;
    this.#clicked = false;
    this.#relativePos = Vector.ZERO.copy();
    this.#pos = Vector.ZERO.copy();

    this.#initListeners(element);
  }

  #initListeners(element) {
    element.onmousemove = (ev) => {
      this.#pos.setHead(ev.clientX, ev.clientY);
      this.#relativePos.setHead(
        ev.clientX / element.width,
        ev.clientY / element.height
      );
    };
    element.ontouchmove = (ev) => {
      this.#pos.setHead(ev.touches[0].clientX, ev.touches[0].clientY);
      this.#relativePos.setHead(
        ev.touches[0].clientX / element.width,
        ev.touches[0].clientY / element.height
      );
    };
    element.onmousedown = element.ontouchstart = (ev) => {
      this.#clicked = this.#down === false;
      this.#down = true;
      if (!isNaN(ev.clientX) && !isNaN(ev.clientY)) {
        this.#pos.setHead(ev.clientX, ev.clientY);
        this.#relativePos.setHead(
          ev.clientX / element.width,
          ev.clientY / element.height
        );
      }
    };
    element.onmouseup = element.ontouchend = () => {
      this.#clicked = false;
      this.#down = false;
    };
  }

  get down() {
    return this.#down;
  }
  get clicked() {
    return this.#clicked;
  }
  get pos() {
    return this.#pos;
  }
  get relativePos() {
    return this.#relativePos;
  }
}
