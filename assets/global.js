function getFocusableElements(container) {
  return Array.from(
    container.querySelectorAll(
      "summary, a[href], button:enabled, [tabindex]:not([tabindex^='-']), [draggable], area, input:not([type=hidden]):enabled, select:enabled, textarea:enabled, object, iframe"
    )
  );
}

class SectionId {
  static #separator = '__';

  // for a qualified section id (e.g. 'template--22224696705326__main'), return just the section id (e.g. 'template--22224696705326')
  static parseId(qualifiedSectionId) {
    return qualifiedSectionId.split(SectionId.#separator)[0];
  }

  // for a qualified section id (e.g. 'template--22224696705326__main'), return just the section name (e.g. 'main')
  static parseSectionName(qualifiedSectionId) {
    return qualifiedSectionId.split(SectionId.#separator)[1];
  }

  // for a section id (e.g. 'template--22224696705326') and a section name (e.g. 'recommended-products'), return a qualified section id (e.g. 'template--22224696705326__recommended-products')
  static getIdForSection(sectionId, sectionName) {
    return `${sectionId}${SectionId.#separator}${sectionName}`;
  }
}

class HTMLUpdateUtility {
  /**
   * Used to swap an HTML node with a new node.
   * The new node is inserted as a previous sibling to the old node, the old node is hidden, and then the old node is removed.
   *
   * The function currently uses a double buffer approach, but this should be replaced by a view transition once it is more widely supported https://developer.mozilla.org/en-US/docs/Web/API/View_Transitions_API
   */
  static viewTransition(oldNode, newContent, preProcessCallbacks = [], postProcessCallbacks = []) {
    preProcessCallbacks?.forEach((callback) => callback(newContent));

    const newNodeWrapper = document.createElement('div');
    HTMLUpdateUtility.setInnerHTML(newNodeWrapper, newContent.outerHTML);
    const newNode = newNodeWrapper.firstChild;

    // dedupe IDs
    const uniqueKey = Date.now();
    oldNode.querySelectorAll('[id], [form]').forEach((element) => {
      element.id && (element.id = `${element.id}-${uniqueKey}`);
      element.form && element.setAttribute('form', `${element.form.getAttribute('id')}-${uniqueKey}`);
    });

    oldNode.parentNode.insertBefore(newNode, oldNode);
    oldNode.style.display = 'none';

    postProcessCallbacks?.forEach((callback) => callback(newNode));

    setTimeout(() => oldNode.remove(), 500);
  }

  // Sets inner HTML and reinjects the script tags to allow execution. By default, scripts are disabled when using element.innerHTML.
  static setInnerHTML(element, html) {
    element.innerHTML = html;
    element.querySelectorAll('script').forEach((oldScriptTag) => {
      const newScriptTag = document.createElement('script');
      Array.from(oldScriptTag.attributes).forEach((attribute) => {
        newScriptTag.setAttribute(attribute.name, attribute.value);
      });
      newScriptTag.appendChild(document.createTextNode(oldScriptTag.innerHTML));
      oldScriptTag.parentNode.replaceChild(newScriptTag, oldScriptTag);
    });
  }
}

document.querySelectorAll('[id^="Details-"] summary').forEach((summary) => {
  summary.setAttribute('role', 'button');
  summary.setAttribute('aria-expanded', summary.parentNode.hasAttribute('open'));

  if (summary.nextElementSibling.getAttribute('id')) {
    summary.setAttribute('aria-controls', summary.nextElementSibling.id);
  }

  summary.addEventListener('click', (event) => {
    event.currentTarget.setAttribute('aria-expanded', !event.currentTarget.closest('details').hasAttribute('open'));
  });

  if (summary.closest('header-drawer, menu-drawer')) return;
  summary.parentElement.addEventListener('keyup', onKeyUpEscape);
});

const trapFocusHandlers = {};

function trapFocus(container, elementToFocus = container) {
  var elements = getFocusableElements(container);
  var first = elements[0];
  var last = elements[elements.length - 1];

  removeTrapFocus();

  trapFocusHandlers.focusin = (event) => {
    if (event.target !== container && event.target !== last && event.target !== first) return;

    document.addEventListener('keydown', trapFocusHandlers.keydown);
  };

  trapFocusHandlers.focusout = function () {
    document.removeEventListener('keydown', trapFocusHandlers.keydown);
  };

  trapFocusHandlers.keydown = function (event) {
    if (event.code.toUpperCase() !== 'TAB') return; // If not TAB key
    // On the last focusable element and tab forward, focus the first element.
    if (event.target === last && !event.shiftKey) {
      event.preventDefault();
      first.focus();
    }

    //  On the first focusable element and tab backward, focus the last element.
    if ((event.target === container || event.target === first) && event.shiftKey) {
      event.preventDefault();
      last.focus();
    }
  };

  document.addEventListener('focusout', trapFocusHandlers.focusout);
  document.addEventListener('focusin', trapFocusHandlers.focusin);

  elementToFocus.focus();

  if (
    elementToFocus.tagName === 'INPUT' &&
    ['search', 'text', 'email', 'url'].includes(elementToFocus.type) &&
    elementToFocus.value
  ) {
    elementToFocus.setSelectionRange(0, elementToFocus.value.length);
  }
}

// Here run the querySelector to figure out if the browser supports :focus-visible or not and run code based on it.
try {
  document.querySelector(':focus-visible');
} catch (e) {
  focusVisiblePolyfill();
}

function focusVisiblePolyfill() {
  const navKeys = [
    'ARROWUP',
    'ARROWDOWN',
    'ARROWLEFT',
    'ARROWRIGHT',
    'TAB',
    'ENTER',
    'SPACE',
    'ESCAPE',
    'HOME',
    'END',
    'PAGEUP',
    'PAGEDOWN',
  ];
  let currentFocusedElement = null;
  let mouseClick = null;

  window.addEventListener('keydown', (event) => {
    if (navKeys.includes(event.code.toUpperCase())) {
      mouseClick = false;
    }
  });

  window.addEventListener('mousedown', (event) => {
    mouseClick = true;
  });

  window.addEventListener(
    'focus',
    () => {
      if (currentFocusedElement) currentFocusedElement.classList.remove('focused');

      if (mouseClick) return;

      currentFocusedElement = document.activeElement;
      currentFocusedElement.classList.add('focused');
    },
    true
  );
}

function pauseAllMedia() {
  document.querySelectorAll('.js-youtube').forEach((video) => {
    video.contentWindow.postMessage('{"event":"command","func":"' + 'pauseVideo' + '","args":""}', '*');
  });
  document.querySelectorAll('.js-vimeo').forEach((video) => {
    video.contentWindow.postMessage('{"method":"pause"}', '*');
  });
  document.querySelectorAll('video').forEach((video) => video.pause());
  document.querySelectorAll('product-model').forEach((model) => {
    if (model.modelViewerUI) model.modelViewerUI.pause();
  });
}

function removeTrapFocus(elementToFocus = null) {
  document.removeEventListener('focusin', trapFocusHandlers.focusin);
  document.removeEventListener('focusout', trapFocusHandlers.focusout);
  document.removeEventListener('keydown', trapFocusHandlers.keydown);

  if (elementToFocus) elementToFocus.focus();
}

function onKeyUpEscape(event) {
  if (event.code.toUpperCase() !== 'ESCAPE') return;

  const openDetailsElement = event.target.closest('details[open]');
  if (!openDetailsElement) return;

  const summaryElement = openDetailsElement.querySelector('summary');
  openDetailsElement.removeAttribute('open');
  summaryElement.setAttribute('aria-expanded', false);
  summaryElement.focus();
}

class QuantityInput extends HTMLElement {
  constructor() {
    super();
    this.input = this.querySelector('input');
    this.changeEvent = new Event('change', { bubbles: true });
    this.input.addEventListener('change', this.onInputChange.bind(this));
    this.querySelectorAll('button').forEach((button) =>
      button.addEventListener('click', this.onButtonClick.bind(this))
    );
  }

  quantityUpdateUnsubscriber = undefined;

  connectedCallback() {
    this.validateQtyRules();
    this.quantityUpdateUnsubscriber = subscribe(PUB_SUB_EVENTS.quantityUpdate, this.validateQtyRules.bind(this));
  }

  disconnectedCallback() {
    if (this.quantityUpdateUnsubscriber) {
      this.quantityUpdateUnsubscriber();
    }
  }

  onInputChange(event) {
    this.validateQtyRules();
  }

  onButtonClick(event) {
    event.preventDefault();
    const previousValue = this.input.value;

    if (event.target.name === 'plus') {
      if (parseInt(this.input.dataset.min) > parseInt(this.input.step) && this.input.value == 0) {
        this.input.value = this.input.dataset.min;
      } else {
        this.input.stepUp();
      }
    } else {
      this.input.stepDown();
    }

    if (previousValue !== this.input.value) this.input.dispatchEvent(this.changeEvent);

    if (this.input.dataset.min === previousValue && event.target.name === 'minus') {
      this.input.value = parseInt(this.input.min);
    }
  }

  validateQtyRules() {
    const value = parseInt(this.input.value);
    if (this.input.min) {
      const buttonMinus = this.querySelector(".quantity__button[name='minus']");
      buttonMinus.classList.toggle('disabled', parseInt(value) <= parseInt(this.input.min));
    }
    if (this.input.max) {
      const max = parseInt(this.input.max);
      const buttonPlus = this.querySelector(".quantity__button[name='plus']");
      buttonPlus.classList.toggle('disabled', value >= max);
    }
  }
}

customElements.define('quantity-input', QuantityInput);

function debounce(fn, wait) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}


function throttle(fn, delay) {
  let lastCall = 0;
  return function (...args) {
    const now = new Date().getTime();
    if (now - lastCall < delay) {
      return;
    }
    lastCall = now;
    return fn(...args);
  };
}

function fetchConfig(type = 'json') {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: `application/${type}` },
  };
}

/*
 * Shopify Common JS
 *
 */
if (typeof window.Shopify == 'undefined') {
  window.Shopify = {};
}

Shopify.bind = function (fn, scope) {
  return function () {
    return fn.apply(scope, arguments);
  };
};

Shopify.setSelectorByValue = function (selector, value) {
  for (var i = 0, count = selector.options.length; i < count; i++) {
    var option = selector.options[i];
    if (value == option.value || value == option.innerHTML) {
      selector.selectedIndex = i;
      return i;
    }
  }
};

Shopify.addListener = function (target, eventName, callback) {
  target.addEventListener
    ? target.addEventListener(eventName, callback, false)
    : target.attachEvent('on' + eventName, callback);
};

Shopify.postLink = function (path, options) {
  options = options || {};
  var method = options['method'] || 'post';
  var params = options['parameters'] || {};

  var form = document.createElement('form');
  form.setAttribute('method', method);
  form.setAttribute('action', path);

  for (var key in params) {
    var hiddenField = document.createElement('input');
    hiddenField.setAttribute('type', 'hidden');
    hiddenField.setAttribute('name', key);
    hiddenField.setAttribute('value', params[key]);
    form.appendChild(hiddenField);
  }
  document.body.appendChild(form);
  form.submit();
  document.body.removeChild(form);
};

Shopify.CountryProvinceSelector = function (country_domid, province_domid, options) {
  this.countryEl = document.getElementById(country_domid);
  this.provinceEl = document.getElementById(province_domid);
  this.provinceContainer = document.getElementById(options['hideElement'] || province_domid);

  Shopify.addListener(this.countryEl, 'change', Shopify.bind(this.countryHandler, this));

  this.initCountry();
  this.initProvince();
};

Shopify.CountryProvinceSelector.prototype = {
  initCountry: function () {
    var value = this.countryEl.getAttribute('data-default');
    Shopify.setSelectorByValue(this.countryEl, value);
    this.countryHandler();
  },

  initProvince: function () {
    var value = this.provinceEl.getAttribute('data-default');
    if (value && this.provinceEl.options.length > 0) {
      Shopify.setSelectorByValue(this.provinceEl, value);
    }
  },

  countryHandler: function (e) {
    var opt = this.countryEl.options[this.countryEl.selectedIndex];
    var raw = opt.getAttribute('data-provinces');
    var provinces = JSON.parse(raw);

    this.clearOptions(this.provinceEl);
    if (provinces && provinces.length == 0) {
      this.provinceContainer.style.display = 'none';
    } else {
      for (var i = 0; i < provinces.length; i++) {
        var opt = document.createElement('option');
        opt.value = provinces[i][0];
        opt.innerHTML = provinces[i][1];
        this.provinceEl.appendChild(opt);
      }

      this.provinceContainer.style.display = '';
    }
  },

  clearOptions: function (selector) {
    while (selector.firstChild) {
      selector.removeChild(selector.firstChild);
    }
  },

  setOptions: function (selector, values) {
    for (var i = 0, count = values.length; i < values.length; i++) {
      var opt = document.createElement('option');
      opt.value = values[i];
      opt.innerHTML = values[i];
      selector.appendChild(opt);
    }
  },
};

class MenuDrawer extends HTMLElement {
  constructor() {
    super();

    this.mainDetailsToggle = this.querySelector('details');

    this.addEventListener('keyup', this.onKeyUp.bind(this));
    this.addEventListener('focusout', this.onFocusOut.bind(this));
    this.bindEvents();
  }

  bindEvents() {
    this.querySelectorAll('summary').forEach((summary) =>
      summary.addEventListener('click', this.onSummaryClick.bind(this))
    );
    this.querySelectorAll(
      'button:not(.localization-selector):not(.country-selector__close-button):not(.country-filter__reset-button)'
    ).forEach((button) => button.addEventListener('click', this.onCloseButtonClick.bind(this)));
  }

  onKeyUp(event) {
    if (event.code.toUpperCase() !== 'ESCAPE') return;

    const openDetailsElement = event.target.closest('details[open]');
    if (!openDetailsElement) return;

    openDetailsElement === this.mainDetailsToggle
      ? this.closeMenuDrawer(event, this.mainDetailsToggle.querySelector('summary'))
      : this.closeSubmenu(openDetailsElement);
  }

  onSummaryClick(event) {
    const summaryElement = event.currentTarget;
    const detailsElement = summaryElement.parentNode;
    const parentMenuElement = detailsElement.closest('.has-submenu');
    const isOpen = detailsElement.hasAttribute('open');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    function addTrapFocus() {
      trapFocus(summaryElement.nextElementSibling, detailsElement.querySelector('button'));
      summaryElement.nextElementSibling.removeEventListener('transitionend', addTrapFocus);
    }

    if (detailsElement === this.mainDetailsToggle) {
      if (isOpen) event.preventDefault();
      isOpen ? this.closeMenuDrawer(event, summaryElement) : this.openMenuDrawer(summaryElement);

      if (window.matchMedia('(max-width: 990px)')) {
        document.documentElement.style.setProperty('--viewport-height', `${window.innerHeight}px`);
      }
    } else {
      setTimeout(() => {
        detailsElement.classList.add('menu-opening');
        summaryElement.setAttribute('aria-expanded', true);
        parentMenuElement && parentMenuElement.classList.add('submenu-open');
        !reducedMotion || reducedMotion.matches
          ? addTrapFocus()
          : summaryElement.nextElementSibling.addEventListener('transitionend', addTrapFocus);
      }, 100);
    }
  }

  openMenuDrawer(summaryElement) {
    setTimeout(() => {
      this.mainDetailsToggle.classList.add('menu-opening');
    });
    summaryElement.setAttribute('aria-expanded', true);
    trapFocus(this.mainDetailsToggle, summaryElement);
    document.body.classList.add(`overflow-hidden-${this.dataset.breakpoint}`);
  }

  closeMenuDrawer(event, elementToFocus = false) {
    if (event === undefined) return;

    this.mainDetailsToggle.classList.remove('menu-opening');
    this.mainDetailsToggle.querySelectorAll('details').forEach((details) => {
      details.removeAttribute('open');
      details.classList.remove('menu-opening');
    });
    this.mainDetailsToggle.querySelectorAll('.submenu-open').forEach((submenu) => {
      submenu.classList.remove('submenu-open');
    });
    document.body.classList.remove(`overflow-hidden-${this.dataset.breakpoint}`);
    removeTrapFocus(elementToFocus);
    this.closeAnimation(this.mainDetailsToggle);

    if (event instanceof KeyboardEvent) elementToFocus?.setAttribute('aria-expanded', false);
  }

  onFocusOut() {
    setTimeout(() => {
      if (this.mainDetailsToggle.hasAttribute('open') && !this.mainDetailsToggle.contains(document.activeElement))
        this.closeMenuDrawer();
    });
  }

  onCloseButtonClick(event) {
    const detailsElement = event.currentTarget.closest('details');
    this.closeSubmenu(detailsElement);
  }

  closeSubmenu(detailsElement) {
    const parentMenuElement = detailsElement.closest('.submenu-open');
    parentMenuElement && parentMenuElement.classList.remove('submenu-open');
    detailsElement.classList.remove('menu-opening');
    detailsElement.querySelector('summary').setAttribute('aria-expanded', false);
    removeTrapFocus(detailsElement.querySelector('summary'));
    this.closeAnimation(detailsElement);
  }

  closeAnimation(detailsElement) {
    let animationStart;

    const handleAnimation = (time) => {
      if (animationStart === undefined) {
        animationStart = time;
      }

      const elapsedTime = time - animationStart;

      if (elapsedTime < 400) {
        window.requestAnimationFrame(handleAnimation);
      } else {
        detailsElement.removeAttribute('open');
        if (detailsElement.closest('details[open]')) {
          trapFocus(detailsElement.closest('details[open]'), detailsElement.querySelector('summary'));
        }
      }
    };

    window.requestAnimationFrame(handleAnimation);
  }
}

customElements.define('menu-drawer', MenuDrawer);

class HeaderDrawer extends MenuDrawer {
  constructor() {
    super();
  }

  openMenuDrawer(summaryElement) {
    this.header = this.header || document.querySelector('.section-header');
    this.borderOffset =
      this.borderOffset || this.closest('.header-wrapper').classList.contains('header-wrapper--border-bottom') ? 1 : 0;
    document.documentElement.style.setProperty(
      '--header-bottom-position',
      `${parseInt(this.header.getBoundingClientRect().bottom - this.borderOffset)}px`
    );
    this.header.classList.add('menu-open');

    setTimeout(() => {
      this.mainDetailsToggle.classList.add('menu-opening');
    });

    summaryElement.setAttribute('aria-expanded', true);
    window.addEventListener('resize', this.onResize);
    trapFocus(this.mainDetailsToggle, summaryElement);
    document.body.classList.add(`overflow-hidden-${this.dataset.breakpoint}`);
  }

  closeMenuDrawer(event, elementToFocus) {
    if (!elementToFocus) return;
    super.closeMenuDrawer(event, elementToFocus);
    this.header.classList.remove('menu-open');
    window.removeEventListener('resize', this.onResize);
  }

  onResize = () => {
    this.header &&
      document.documentElement.style.setProperty(
        '--header-bottom-position',
        `${parseInt(this.header.getBoundingClientRect().bottom - this.borderOffset)}px`
      );
    document.documentElement.style.setProperty('--viewport-height', `${window.innerHeight}px`);
  };
}

customElements.define('header-drawer', HeaderDrawer);

class ModalDialog extends HTMLElement {
  constructor() {
    super();
    this.querySelector('[id^="ModalClose-"]').addEventListener('click', this.hide.bind(this, false));
    this.addEventListener('keyup', (event) => {
      if (event.code.toUpperCase() === 'ESCAPE') this.hide();
    });
    if (this.classList.contains('media-modal')) {
      this.addEventListener('pointerup', (event) => {
        if (event.pointerType === 'mouse' && !event.target.closest('deferred-media, product-model')) this.hide();
      });
    } else {
      this.addEventListener('click', (event) => {
        if (event.target === this) this.hide();
      });
    }
  }

  connectedCallback() {
    if (this.moved) return;
    this.moved = true;
    this.dataset.section = this.closest('.shopify-section').id.replace('shopify-section-', '');
    document.body.appendChild(this);
  }

  show(opener) {
    this.openedBy = opener;
    const popup = this.querySelector('.template-popup');
    document.body.classList.add('overflow-hidden');
    this.setAttribute('open', '');
    if (popup) popup.loadContent();
    trapFocus(this, this.querySelector('[role="dialog"]'));
    window.pauseAllMedia();
  }

  hide() {
    document.body.classList.remove('overflow-hidden');
    document.body.dispatchEvent(new CustomEvent('modalClosed'));
    this.removeAttribute('open');
    removeTrapFocus(this.openedBy);
    window.pauseAllMedia();
  }
}
customElements.define('modal-dialog', ModalDialog);

class BulkModal extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    const handleIntersection = (entries, observer) => {
      if (!entries[0].isIntersecting) return;
      observer.unobserve(this);
      if (this.innerHTML.trim() === '') {
        const productUrl = this.dataset.url.split('?')[0];
        fetch(`${productUrl}?section_id=bulk-quick-order-list`)
          .then((response) => response.text())
          .then((responseText) => {
            const html = new DOMParser().parseFromString(responseText, 'text/html');
            const sourceQty = html.querySelector('.quick-order-list-container').parentNode;
            this.innerHTML = sourceQty.innerHTML;
          })
          .catch((e) => {
            console.error(e);
          });
      }
    };

    new IntersectionObserver(handleIntersection.bind(this)).observe(
      document.querySelector(`#QuickBulk-${this.dataset.productId}-${this.dataset.sectionId}`)
    );
  }
}

customElements.define('bulk-modal', BulkModal);

class ModalOpener extends HTMLElement {
  constructor() {
    super();

    const button = this.querySelector('button');

    if (!button) return;
    button.addEventListener('click', () => {
      const modal = document.querySelector(this.getAttribute('data-modal'));
      if (modal) modal.show(button);
    });
  }
}
customElements.define('modal-opener', ModalOpener);

class DeferredMedia extends HTMLElement {
  constructor() {
    super();
    const poster = this.querySelector('[id^="Deferred-Poster-"]');
    if (!poster) return;
    poster.addEventListener('click', this.loadContent.bind(this));
  }

  loadContent(focus = true) {
    window.pauseAllMedia();
    if (!this.getAttribute('loaded')) {
      const content = document.createElement('div');
      content.appendChild(this.querySelector('template').content.firstElementChild.cloneNode(true));

      this.setAttribute('loaded', true);
      const deferredElement = this.appendChild(content.querySelector('video, model-viewer, iframe'));
      if (focus) deferredElement.focus();
      if (deferredElement.nodeName == 'VIDEO' && deferredElement.getAttribute('autoplay')) {
        // force autoplay for safari
        deferredElement.play();
      }

      // Workaround for safari iframe bug
      const formerStyle = deferredElement.getAttribute('style');
      deferredElement.setAttribute('style', 'display: block;');
      window.setTimeout(() => {
        deferredElement.setAttribute('style', formerStyle);
      }, 0);
    }
  }
}

customElements.define('deferred-media', DeferredMedia);

class SliderComponent extends HTMLElement {
  constructor() {
    super();
    this.slider = this.querySelector('[id^="Slider-"]');
    this.sliderItems = this.querySelectorAll('[id^="Slide-"]');
    this.enableSliderLooping = false;
    this.currentPageElement = this.querySelector('.slider-counter--current');
    this.pageTotalElement = this.querySelector('.slider-counter--total');
    this.prevButton = this.querySelector('button[name="previous"]');
    this.nextButton = this.querySelector('button[name="next"]');

    if (!this.slider || !this.nextButton) return;

    this.initPages();
    const resizeObserver = new ResizeObserver((entries) => this.initPages());
    resizeObserver.observe(this.slider);

    this.slider.addEventListener('scroll', this.update.bind(this));
    this.prevButton.addEventListener('click', this.onButtonClick.bind(this));
    this.nextButton.addEventListener('click', this.onButtonClick.bind(this));
  }

  initPages() {
    this.sliderItemsToShow = Array.from(this.sliderItems).filter((element) => element.clientWidth > 0);
    if (this.sliderItemsToShow.length < 2) return;
    this.sliderItemOffset = this.sliderItemsToShow[1].offsetLeft - this.sliderItemsToShow[0].offsetLeft;
    this.slidesPerPage = Math.floor(
      (this.slider.clientWidth - this.sliderItemsToShow[0].offsetLeft) / this.sliderItemOffset
    );
    this.totalPages = this.sliderItemsToShow.length - this.slidesPerPage + 1;
    this.update();
  }

  resetPages() {
    this.sliderItems = this.querySelectorAll('[id^="Slide-"]');
    this.initPages();
  }

  update() {
    // Temporarily prevents unneeded updates resulting from variant changes
    // This should be refactored as part of https://github.com/Shopify/dawn/issues/2057
    if (!this.slider || !this.nextButton) return;

    const previousPage = this.currentPage;
    this.currentPage = Math.round(this.slider.scrollLeft / this.sliderItemOffset) + 1;

    if (this.currentPageElement && this.pageTotalElement) {
      this.currentPageElement.textContent = this.currentPage;
      this.pageTotalElement.textContent = this.totalPages;
    }

    if (this.currentPage != previousPage) {
      this.dispatchEvent(
        new CustomEvent('slideChanged', {
          detail: {
            currentPage: this.currentPage,
            currentElement: this.sliderItemsToShow[this.currentPage - 1],
          },
        })
      );
    }

    if (this.enableSliderLooping) return;

    if (this.isSlideVisible(this.sliderItemsToShow[0]) && this.slider.scrollLeft === 0) {
      this.prevButton.setAttribute('disabled', 'disabled');
    } else {
      this.prevButton.removeAttribute('disabled');
    }

    if (this.isSlideVisible(this.sliderItemsToShow[this.sliderItemsToShow.length - 1])) {
      this.nextButton.setAttribute('disabled', 'disabled');
    } else {
      this.nextButton.removeAttribute('disabled');
    }
  }

  isSlideVisible(element, offset = 0) {
    const lastVisibleSlide = this.slider.clientWidth + this.slider.scrollLeft - offset;
    return element.offsetLeft + element.clientWidth <= lastVisibleSlide && element.offsetLeft >= this.slider.scrollLeft;
  }

  onButtonClick(event) {
    event.preventDefault();
    const step = event.currentTarget.dataset.step || 1;
    this.slideScrollPosition =
      event.currentTarget.name === 'next'
        ? this.slider.scrollLeft + step * this.sliderItemOffset
        : this.slider.scrollLeft - step * this.sliderItemOffset;
    this.setSlidePosition(this.slideScrollPosition);
  }

  setSlidePosition(position) {
    this.slider.scrollTo({
      left: position,
    });
  }
}

customElements.define('slider-component', SliderComponent);

class SlideshowComponent extends SliderComponent {
  constructor() {
    super();
    this.sliderControlWrapper = this.querySelector('.slider-buttons');
    this.enableSliderLooping = true;

    if (!this.sliderControlWrapper) return;

    this.sliderFirstItemNode = this.slider.querySelector('.slideshow__slide');
    if (this.sliderItemsToShow.length > 0) this.currentPage = 1;

    this.announcementBarSlider = this.querySelector('.announcement-bar-slider');
    // Value below should match --duration-announcement-bar CSS value
    this.announcerBarAnimationDelay = this.announcementBarSlider ? 250 : 0;

    this.sliderControlLinksArray = Array.from(this.sliderControlWrapper.querySelectorAll('.slider-counter__link'));
    this.sliderControlLinksArray.forEach((link) => link.addEventListener('click', this.linkToSlide.bind(this)));
    this.slider.addEventListener('scroll', this.setSlideVisibility.bind(this));
    this.setSlideVisibility();

    if (this.announcementBarSlider) {
      this.announcementBarArrowButtonWasClicked = false;

      this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.reducedMotion.addEventListener('change', () => {
        if (this.slider.getAttribute('data-autoplay') === 'true') this.setAutoPlay();
      });

      [this.prevButton, this.nextButton].forEach((button) => {
        button.addEventListener(
          'click',
          () => {
            this.announcementBarArrowButtonWasClicked = true;
          },
          { once: true }
        );
      });
    }

    if (this.slider.getAttribute('data-autoplay') === 'true') this.setAutoPlay();
  }

  setAutoPlay() {
    this.autoplaySpeed = this.slider.dataset.speed * 1000;
    this.addEventListener('mouseover', this.focusInHandling.bind(this));
    this.addEventListener('mouseleave', this.focusOutHandling.bind(this));
    this.addEventListener('focusin', this.focusInHandling.bind(this));
    this.addEventListener('focusout', this.focusOutHandling.bind(this));

    if (this.querySelector('.slideshow__autoplay')) {
      this.sliderAutoplayButton = this.querySelector('.slideshow__autoplay');
      this.sliderAutoplayButton.addEventListener('click', this.autoPlayToggle.bind(this));
      this.autoplayButtonIsSetToPlay = true;
      this.play();
    } else {
      this.reducedMotion.matches || this.announcementBarArrowButtonWasClicked ? this.pause() : this.play();
    }
  }

  onButtonClick(event) {
    super.onButtonClick(event);
    this.wasClicked = true;

    const isFirstSlide = this.currentPage === 1;
    const isLastSlide = this.currentPage === this.sliderItemsToShow.length;

    if (!isFirstSlide && !isLastSlide) {
      this.applyAnimationToAnnouncementBar(event.currentTarget.name);
      return;
    }

    if (isFirstSlide && event.currentTarget.name === 'previous') {
      this.slideScrollPosition =
        this.slider.scrollLeft + this.sliderFirstItemNode.clientWidth * this.sliderItemsToShow.length;
    } else if (isLastSlide && event.currentTarget.name === 'next') {
      this.slideScrollPosition = 0;
    }

    this.setSlidePosition(this.slideScrollPosition);

    this.applyAnimationToAnnouncementBar(event.currentTarget.name);
  }

  setSlidePosition(position) {
    if (this.setPositionTimeout) clearTimeout(this.setPositionTimeout);
    this.setPositionTimeout = setTimeout(() => {
      this.slider.scrollTo({
        left: position,
      });
    }, this.announcerBarAnimationDelay);
  }

  update() {
    super.update();
    this.sliderControlButtons = this.querySelectorAll('.slider-counter__link');
    this.prevButton.removeAttribute('disabled');

    if (!this.sliderControlButtons.length) return;

    this.sliderControlButtons.forEach((link) => {
      link.classList.remove('slider-counter__link--active');
      link.removeAttribute('aria-current');
    });
    this.sliderControlButtons[this.currentPage - 1].classList.add('slider-counter__link--active');
    this.sliderControlButtons[this.currentPage - 1].setAttribute('aria-current', true);
  }

  autoPlayToggle() {
    this.togglePlayButtonState(this.autoplayButtonIsSetToPlay);
    this.autoplayButtonIsSetToPlay ? this.pause() : this.play();
    this.autoplayButtonIsSetToPlay = !this.autoplayButtonIsSetToPlay;
  }

  focusOutHandling(event) {
    if (this.sliderAutoplayButton) {
      const focusedOnAutoplayButton =
        event.target === this.sliderAutoplayButton || this.sliderAutoplayButton.contains(event.target);
      if (!this.autoplayButtonIsSetToPlay || focusedOnAutoplayButton) return;
      this.play();
    } else if (!this.reducedMotion.matches && !this.announcementBarArrowButtonWasClicked) {
      this.play();
    }
  }

  focusInHandling(event) {
    if (this.sliderAutoplayButton) {
      const focusedOnAutoplayButton =
        event.target === this.sliderAutoplayButton || this.sliderAutoplayButton.contains(event.target);
      if (focusedOnAutoplayButton && this.autoplayButtonIsSetToPlay) {
        this.play();
      } else if (this.autoplayButtonIsSetToPlay) {
        this.pause();
      }
    } else if (this.announcementBarSlider.contains(event.target)) {
      this.pause();
    }
  }

  play() {
    this.slider.setAttribute('aria-live', 'off');
    clearInterval(this.autoplay);
    this.autoplay = setInterval(this.autoRotateSlides.bind(this), this.autoplaySpeed);
  }

  pause() {
    this.slider.setAttribute('aria-live', 'polite');
    clearInterval(this.autoplay);
  }

  togglePlayButtonState(pauseAutoplay) {
    if (pauseAutoplay) {
      this.sliderAutoplayButton.classList.add('slideshow__autoplay--paused');
      this.sliderAutoplayButton.setAttribute('aria-label', window.accessibilityStrings.playSlideshow);
    } else {
      this.sliderAutoplayButton.classList.remove('slideshow__autoplay--paused');
      this.sliderAutoplayButton.setAttribute('aria-label', window.accessibilityStrings.pauseSlideshow);
    }
  }

  autoRotateSlides() {
    const slideScrollPosition =
      this.currentPage === this.sliderItems.length ? 0 : this.slider.scrollLeft + this.sliderItemOffset;

    this.setSlidePosition(slideScrollPosition);
    this.applyAnimationToAnnouncementBar();
  }

  setSlideVisibility(event) {
    this.sliderItemsToShow.forEach((item, index) => {
      const linkElements = item.querySelectorAll('a');
      if (index === this.currentPage - 1) {
        if (linkElements.length)
          linkElements.forEach((button) => {
            button.removeAttribute('tabindex');
          });
        item.setAttribute('aria-hidden', 'false');
        item.removeAttribute('tabindex');
      } else {
        if (linkElements.length)
          linkElements.forEach((button) => {
            button.setAttribute('tabindex', '-1');
          });
        item.setAttribute('aria-hidden', 'true');
        item.setAttribute('tabindex', '-1');
      }
    });
    this.wasClicked = false;
  }

  applyAnimationToAnnouncementBar(button = 'next') {
    if (!this.announcementBarSlider) return;

    const itemsCount = this.sliderItems.length;
    const increment = button === 'next' ? 1 : -1;

    const currentIndex = this.currentPage - 1;
    let nextIndex = (currentIndex + increment) % itemsCount;
    nextIndex = nextIndex === -1 ? itemsCount - 1 : nextIndex;

    const nextSlide = this.sliderItems[nextIndex];
    const currentSlide = this.sliderItems[currentIndex];

    const animationClassIn = 'announcement-bar-slider--fade-in';
    const animationClassOut = 'announcement-bar-slider--fade-out';

    const isFirstSlide = currentIndex === 0;
    const isLastSlide = currentIndex === itemsCount - 1;

    const shouldMoveNext = (button === 'next' && !isLastSlide) || (button === 'previous' && isFirstSlide);
    const direction = shouldMoveNext ? 'next' : 'previous';

    currentSlide.classList.add(`${animationClassOut}-${direction}`);
    nextSlide.classList.add(`${animationClassIn}-${direction}`);

    setTimeout(() => {
      currentSlide.classList.remove(`${animationClassOut}-${direction}`);
      nextSlide.classList.remove(`${animationClassIn}-${direction}`);
    }, this.announcerBarAnimationDelay * 2);
  }

  linkToSlide(event) {
    event.preventDefault();
    const slideScrollPosition =
      this.slider.scrollLeft +
      this.sliderFirstItemNode.clientWidth *
        (this.sliderControlLinksArray.indexOf(event.currentTarget) + 1 - this.currentPage);
    this.slider.scrollTo({
      left: slideScrollPosition,
    });
  }
}

customElements.define('slideshow-component', SlideshowComponent);

class VariantSelects extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    this.addEventListener('change', (event) => {
      const target = this.getInputForEventTarget(event.target);
      this.updateSelectionMetadata(event);

      publish(PUB_SUB_EVENTS.optionValueSelectionChange, {
        data: {
          event,
          target,
          selectedOptionValues: this.selectedOptionValues,
        },
      });
    });
  }

  updateSelectionMetadata({ target }) {
    const { value, tagName } = target;

    if (tagName === 'SELECT' && target.selectedOptions.length) {
      Array.from(target.options)
        .find((option) => option.getAttribute('selected'))
        .removeAttribute('selected');
      target.selectedOptions[0].setAttribute('selected', 'selected');

      const swatchValue = target.selectedOptions[0].dataset.optionSwatchValue;
      const selectedDropdownSwatchValue = target
        .closest('.product-form__input')
        .querySelector('[data-selected-value] > .swatch');
      if (!selectedDropdownSwatchValue) return;
      if (swatchValue) {
        selectedDropdownSwatchValue.style.setProperty('--swatch--background', swatchValue);
        selectedDropdownSwatchValue.classList.remove('swatch--unavailable');
      } else {
        selectedDropdownSwatchValue.style.setProperty('--swatch--background', 'unset');
        selectedDropdownSwatchValue.classList.add('swatch--unavailable');
      }

      selectedDropdownSwatchValue.style.setProperty(
        '--swatch-focal-point',
        target.selectedOptions[0].dataset.optionSwatchFocalPoint || 'unset'
      );
    } else if (tagName === 'INPUT' && target.type === 'radio') {
      const selectedSwatchValue = target.closest(`.product-form__input`).querySelector('[data-selected-value]');
      if (selectedSwatchValue) selectedSwatchValue.innerHTML = value;
    }
  }

  getInputForEventTarget(target) {
    return target.tagName === 'SELECT' ? target.selectedOptions[0] : target;
  }

  get selectedOptionValues() {
    return Array.from(this.querySelectorAll('select option[selected], fieldset input:checked')).map(
      ({ dataset }) => dataset.optionValueId
    );
  }
}

customElements.define('variant-selects', VariantSelects);

class ProductRecommendations extends HTMLElement {
  observer = undefined;

  constructor() {
    super();
  }

  connectedCallback() {
    this.initializeRecommendations(this.dataset.productId);
  }

  initializeRecommendations(productId) {
    this.observer?.unobserve(this);
    this.observer = new IntersectionObserver(
      (entries, observer) => {
        if (!entries[0].isIntersecting) return;
        observer.unobserve(this);
        this.loadRecommendations(productId);
      },
      { rootMargin: '0px 0px 400px 0px' }
    );
    this.observer.observe(this);
  }

  loadRecommendations(productId) {
    fetch(`${this.dataset.url}&product_id=${productId}&section_id=${this.dataset.sectionId}`)
      .then((response) => response.text())
      .then((text) => {
        const html = document.createElement('div');
        html.innerHTML = text;
        const recommendations = html.querySelector('product-recommendations');

        if (recommendations?.innerHTML.trim().length) {
          this.innerHTML = recommendations.innerHTML;
        }

        if (!this.querySelector('slideshow-component') && this.classList.contains('complementary-products')) {
          this.remove();
        }

        if (html.querySelector('.grid__item')) {
          this.classList.add('product-recommendations--loaded');
        }
      })
      .catch((e) => {
        console.error(e);
      });
  }
}

customElements.define('product-recommendations', ProductRecommendations);

class AccountIcon extends HTMLElement {
  constructor() {
    super();

    this.icon = this.querySelector('.icon');
  }

  connectedCallback() {
    document.addEventListener('storefront:signincompleted', this.handleStorefrontSignInCompleted.bind(this));
  }

  handleStorefrontSignInCompleted(event) {
    if (event?.detail?.avatar) {
      this.icon?.replaceWith(event.detail.avatar.cloneNode());
    }
  }
}

customElements.define('account-icon', AccountIcon);

class BulkAdd extends HTMLElement {
  static ASYNC_REQUEST_DELAY = 250;

  constructor() {
    super();
    this.queue = [];
    this.setRequestStarted(false);
    this.ids = [];
  }

  startQueue(id, quantity) {
    this.queue.push({ id, quantity });

    const interval = setInterval(() => {
      if (this.queue.length > 0) {
        if (!this.requestStarted) {
          this.sendRequest(this.queue);
        }
      } else {
        clearInterval(interval);
      }
    }, BulkAdd.ASYNC_REQUEST_DELAY);
  }

  sendRequest(queue) {
    this.setRequestStarted(true);
    const items = {};

    queue.forEach((queueItem) => {
      items[parseInt(queueItem.id)] = queueItem.quantity;
    });
    this.queue = this.queue.filter((queueElement) => !queue.includes(queueElement));

    this.updateMultipleQty(items);
  }

  setRequestStarted(requestStarted) {
    this._requestStarted = requestStarted;
  }

  get requestStarted() {
    return this._requestStarted;
  }

  resetQuantityInput(id) {
    const input = this.querySelector(`#Quantity-${id}`);
    input.value = input.getAttribute('value');
    this.isEnterPressed = false;
  }

  setValidity(event, index, message) {
    event.target.setCustomValidity(message);
    event.target.reportValidity();
    this.resetQuantityInput(index);
    event.target.select();
  }

  validateQuantity(event) {
    const inputValue = parseInt(event.target.value);
    const index = event.target.dataset.index;

    if (inputValue < event.target.dataset.min) {
      this.setValidity(event, index, window.quickOrderListStrings.min_error.replace('[min]', event.target.dataset.min));
    } else if (inputValue > parseInt(event.target.max)) {
      this.setValidity(event, index, window.quickOrderListStrings.max_error.replace('[max]', event.target.max));
    } else if (inputValue % parseInt(event.target.step) != 0) {
      this.setValidity(event, index, window.quickOrderListStrings.step_error.replace('[step]', event.target.step));
    } else {
      event.target.setCustomValidity('');
      event.target.reportValidity();
      event.target.setAttribute('value', inputValue);
      this.startQueue(index, inputValue);
    }
  }

  getSectionInnerHTML(html, selector) {
    return new DOMParser().parseFromString(html, 'text/html').querySelector(selector).innerHTML;
  }
}

if (!customElements.get('bulk-add')) {
  customElements.define('bulk-add', BulkAdd);
}

class CartPerformance {
  static #metric_prefix = "cart-performance"

  static createStartingMarker(benchmarkName) {
    const metricName = `${CartPerformance.#metric_prefix}:${benchmarkName}`
    return performance.mark(`${metricName}:start`);
  }

  static measureFromEvent(benchmarkName, event) {
    const metricName = `${CartPerformance.#metric_prefix}:${benchmarkName}`
    const startMarker = performance.mark(`${metricName}:start`, {
      startTime: event.timeStamp
    });

    const endMarker = performance.mark(`${metricName}:end`);

    performance.measure(
      metricName,
      `${metricName}:start`,
      `${metricName}:end`
    );
  }

  static measureFromMarker(benchmarkName, startMarker) {
    const metricName = `${CartPerformance.#metric_prefix}:${benchmarkName}`
    const endMarker = performance.mark(`${metricName}:end`);

    performance.measure(
      metricName,
      startMarker.name,
      `${metricName}:end`
    );
  }

  static measure(benchmarkName, callback) {
    const metricName = `${CartPerformance.#metric_prefix}:${benchmarkName}`
    const startMarker = performance.mark(`${metricName}:start`);

    callback();

    const endMarker = performance.mark(`${metricName}:end`);

    performance.measure(
      metricName,
      `${metricName}:start`,
      `${metricName}:end`
    );
  }
}



// document.addEventListener("DOMContentLoaded", function () {

//   const buttons = document.querySelectorAll(".addon-add-btn");

//   async function getCart() {
//     const res = await fetch("/cart.js");
//     return await res.json();
//   }

//   async function refreshCartDrawer() {

//     const res = await fetch('/?section_id=cart-drawer');
//     const html = await res.text();

//     const parser = new DOMParser();
//     const doc = parser.parseFromString(html, 'text/html');

//     const newDrawer = doc.querySelector('cart-drawer');
//     const currentDrawer = document.querySelector('cart-drawer');

//     if (newDrawer && currentDrawer) {
//       currentDrawer.innerHTML = newDrawer.innerHTML;
//     }

//   }

//   async function updateCartCount() {

//     const cart = await getCart();

//     const bubbles = document.querySelectorAll('.cart-count-bubble, .cart-count');

//     bubbles.forEach(el => {
//       el.textContent = cart.item_count;
//     });

//   }

//   async function updateButtons() {

//     const cart = await getCart();

//     buttons.forEach(btn => {

//       const variantId = btn.dataset.variantId;
//       const item = cart.items.find(i => i.variant_id == variantId);

//       if (item) {
//         btn.classList.add("added");
//         btn.textContent = "Added";
//         btn.dataset.wasInCart = "true";
//       } else {
//         btn.classList.remove("added");
//         btn.textContent = "Add";
//       }

//     });

//   }

//   async function removeFromCart(variantId) {

//     const cart = await getCart();
//     const item = cart.items.find(i => i.variant_id == variantId);

//     if (!item) return;

//     await fetch("/cart/change.js", {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json"
//       },
//       body: JSON.stringify({
//         id: item.key,
//         quantity: 0
//       })
//     });

//     await refreshCartDrawer();
//     await updateButtons();
//     await updateCartCount();

//   }

//   async function addToCart(variantId, openCart) {

//     await fetch("/cart/add.js", {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json"
//       },
//       body: JSON.stringify({
//         items: [{
//           id: variantId,
//           quantity: 1
//         }]
//       })
//     });

//     await refreshCartDrawer();
//     await updateButtons();
//     await updateCartCount();

//     if (openCart) {

//       const drawer = document.querySelector("cart-drawer") || document.querySelector(".cart-drawer");

//       if (drawer) {
//         drawer.classList.add("active");
//       }

//     }

//   }

//   buttons.forEach(btn => {

//     btn.dataset.wasInCart = "false";

//     btn.addEventListener("click", async function () {

//       const variantId = this.dataset.variantId;

//       if (this.classList.contains("added")) {

//         await removeFromCart(variantId);

//       } else {

//         const openCart = this.dataset.wasInCart === "true";

//         await addToCart(variantId, openCart);

//         this.dataset.wasInCart = "true";

//       }

//     });

//   });

//   updateButtons();
//   updateCartCount();

//   setInterval(updateButtons, 1500);

// });



// document.addEventListener('click', function (e) {

//   const btn = e.target.closest('.compare-btn');
//   if (!btn) return;

//   e.preventDefault();

//   const handle = btn.dataset.productHandle;
//   if (!handle) return;

//   let compareList = JSON.parse(localStorage.getItem('compareProducts')) || [];

//   // already selected → redirect
//   if (btn.classList.contains('selected')) {
//     window.location.href = '/search/?view=compare';
//     return;
//   }

//   // avoid duplicate
//   if (!compareList.includes(handle)) {
//     compareList.push(handle);
//   }

//   btn.classList.add('selected');

//   localStorage.setItem('compareProducts', JSON.stringify(compareList));

// });

// (function () {

//   function runCompare() {

//     if (!window.location.search.includes('view=compare')) return;

//     const headRow = document.querySelector('#compare-head');
//     const compareContainer = document.querySelector('#compare-container');

//     if (!headRow || !compareContainer) return;

//     let compareList = JSON.parse(localStorage.getItem('compareProducts')) || [];

//     if (compareList.length === 0) {
//       compareContainer.innerHTML = '<p>No products selected for comparison.</p>';
//       return;
//     }


//     headRow.querySelectorAll('.compare-cell:not(.compare-attr)').forEach(el => el.remove());

//     document.querySelectorAll('#compare-table .compare-row').forEach(row => {
//       row.querySelectorAll('.compare-cell:not(.compare-attr)').forEach(cell => cell.remove());
//     });

//  const formatMoney = (cents) => {
//   const amount = (cents / 100);

//   return new Intl.NumberFormat(
//     document.documentElement.lang || 'en',
//     {
//       style: 'currency',
//       currency: window.Shopify?.currency?.active || 'INR'
//     }
//   ).format(amount);
// };

//     Promise.all(
//       compareList.map(handle =>
//         fetch(`/products/${handle}.js`)
//           .then(res => res.json())
//           .catch(() => null)
//       )
//     ).then(products => {
//       const placeholderEl = document.querySelector('#placeholder-template');
// const placeholder = placeholderEl ? placeholderEl.innerHTML : '';

//       products.forEach((p, i) => {

//         if (!p) return;

//         const handle = compareList[i]; 

// const imageHTML = p.featured_image
//   ? `
//     <div class="media media--transparent" style="padding-top:100%; position:relative;">
//       <img 
//         src="${p.featured_image}" 
//         alt="${p.title}" 
//         loading="lazy"
//         class="motion-reduce" 
//         style="position:absolute; top:0; left:0; width:100%; height:100%; object-fit:cover;"
//       >
//     </div>
//   `
//   : `
//     <div class="media media--transparent placeholder" style="padding-top:100%; position:relative;">
//       ${placeholder}
//     </div>
//   `;
      
//         headRow.insertAdjacentHTML(
//           'beforeend',
//           `
//           <div class="compare-cell" data-handle="${handle}">
//             <div class="compare-card">
//             <a href="javascript:void(0);" class="remove-compare" data-handle="${handle}">Remove </a>

//               <a class="product-img" href="${p.url}">
//             ${imageHTML}
//           </a>
//   <h4>${p.title}</h4>
  
//   <div class="price price--large price--on-sale">
//   <div class="price__container">            
// <p class="price__sale">
//   ${
//     p.compare_at_price && p.compare_at_price > p.price
//       ? `<span class="compare-price price-item price-item--regular">${formatMoney(p.compare_at_price)}</span>`
//       : ''
//   }
//   <span class="sale-price price-item price-item--sale price-item--last">${formatMoney(p.price)}</span>
// </p>
//       </div>
//       </div>
//             </div>
//           </div>
//           `
//         );
   
     
//         document.querySelector('#row-available')?.insertAdjacentHTML(
//           'beforeend',
//           `<div class="compare-cell">
//              ${p.available ? 'In Stock' : 'Out of Stock'}
//            </div>`
//         );


//         document.querySelector('#row-vendor')?.insertAdjacentHTML(
//           'beforeend',
//           `<div class="compare-cell">
//              ${p.vendor ? p.vendor : 'N/A'}
//            </div>`
//         );

//           let colors = [];

// if (p.options && p.variants) {

//   const colorIndex = p.options.findIndex(opt => {

//     let name = '';

//     if (typeof opt === 'string') {
//       name = opt;
//     } else if (typeof opt === 'object' && opt.name) {
//       name = opt.name;
//     }

//     name = name.toLowerCase();

//     return name.includes('color') || name.includes('colour');
//   });

//   if (colorIndex !== -1) {
//     colors = [...new Set(
//       p.variants.map(v => v[`option${colorIndex + 1}`]).filter(Boolean)
//     )];
//   }
// }

// document.querySelector('#row-color')?.insertAdjacentHTML(
//   'beforeend',
//   `<div class="compare-cell">
//     ${colors.length ? colors.join(', ') : 'No color variations'}
//   </div>`
// );

//       });

//     });

//   }


//   const observer = new MutationObserver(() => {
//     if (document.querySelector('#compare-head')) {
//       runCompare();
//       observer.disconnect();
//     }
//   });

//   observer.observe(document.body, { childList: true, subtree: true });


//   document.addEventListener('click', function (e) {

//     const btn = e.target.closest('.remove-compare');
//     if (!btn) return;

//     e.preventDefault();

//     let compareList = JSON.parse(localStorage.getItem('compareProducts')) || [];
//     const handle = btn.dataset.handle;

//     compareList = compareList.filter(item => item !== handle);
//     localStorage.setItem('compareProducts', JSON.stringify(compareList));


//     const headers = document.querySelectorAll('#compare-head .compare-cell');

//     let removeIndex = -1;

//     headers.forEach((cell, i) => {
//       if (cell.dataset.handle === handle) {
//         removeIndex = i;
//       }
//     });

//     if (removeIndex === -1) return;

//     document.querySelectorAll('#compare-table .compare-row').forEach(row => {
//       const cells = row.querySelectorAll('.compare-cell');
//       if (cells[removeIndex]) {
//         cells[removeIndex].remove();
//       }
//     });

//     if (compareList.length === 0) {
//       document.querySelector('#compare-container').innerHTML =
//         '<p>No products selected for comparison.</p>';
//     }

//   });

// })();


// window.addEventListener('pageshow', function() {

//   const buttons = document.querySelectorAll('.compare-btn');
//   if(!buttons.length) return;

//   let compareList = JSON.parse(localStorage.getItem('compareProducts')) || [];

//   buttons.forEach(btn => {
//     const handle = btn.dataset.productHandle;

//     if(compareList.includes(handle)) {
//       btn.classList.add('selected');
//     } else {
//       btn.classList.remove('selected');
//     }
//   });

// });

// (function() {

//   function updateCompareCount() {
//     const compareList = JSON.parse(localStorage.getItem('compareProducts')) || [];
//     const countEl = document.querySelector('#compare-count');
//     const bubble = document.querySelector('.compare-count-bubble');

//     if (countEl) {
//       const count = compareList.length;
//       countEl.innerText = count;

      
//       if (bubble) {
//         bubble.style.display = count === 0 ? 'none' : 'block';
//       }
//     }
//   }

//   updateCompareCount();

//   if (!document.querySelector('#compare-count')) {
//     const observer = new MutationObserver((mutations, obs) => {
//       const countEl = document.querySelector('#compare-count');
//       if (countEl) {
//         updateCompareCount();
//         obs.disconnect(); 
//       }
//     });

//     observer.observe(document.body, { childList: true, subtree: true });
//   }

//   document.addEventListener('click', function(e) {
//     const btn = e.target.closest('.compare-btn, .remove-compare');
//     if (!btn) return;

//     setTimeout(updateCompareCount, 50);
//   });

// })();




// (function() {

//   const STORAGE_KEY = 'wishlistProducts';


//   const params = new URLSearchParams(window.location.search);
//   const isWishlistPage = params.get('view') === 'wishlist';


//   function getWishlist() {
//     try {
//       let list = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
//       return list.filter(item => isNaN(item));
//     } catch (e) {
//       return [];
//     }
//   }


//   function saveWishlist(list) {
//     localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
//   }


//   function updateWishlistIcons() {
//     const list = getWishlist();

//     document.querySelectorAll('.wishlist-btn').forEach(btn => {
//       const handle = btn.dataset.productHandle;
//       if (!handle) return;

//       btn.classList.toggle('is-active', list.includes(handle));

//       const extraTarget = btn.closest('.wishlist-actions'); 
// if (extraTarget) {
//   extraTarget.classList.toggle('active-btn', list.includes(handle));
// }
//     });
//   }


//   if (!isWishlistPage) {

//     document.addEventListener('click', function(e) {
//       const btn = e.target.closest('.wishlist-btn');
//       if (!btn) return;

//       const handle = btn.dataset.productHandle;
//       if (!handle) return;

//       let list = getWishlist();

    
//       if (list.includes(handle)) {
//         window.location.href = '/search?view=wishlist';
//         return;
//       }


//       list = [...new Set([...list, handle])];
//       saveWishlist(list);

//       btn.classList.add('is-active');

//       const extraTarget = btn.closest('.wishlist-actions');
// if (extraTarget) {
//   extraTarget.classList.add('active-btn');
// }
//     });


//     updateWishlistIcons();


//     window.addEventListener('pageshow', updateWishlistIcons);


//     window.addEventListener('storage', function(e) {
//       if (e.key === STORAGE_KEY) {
//         updateWishlistIcons();
//       }
//     });

//     const observer = new MutationObserver(updateWishlistIcons);
//     observer.observe(document.body, { childList: true, subtree: true });

//   }


//   if (isWishlistPage) {

//     const container = document.querySelector('.wishlist-products');
//     if (!container) return;

//     let wishlist = getWishlist();


//     if (wishlist.length === 0) {
//       container.innerHTML = '<p class="center">No products in wishlist</p>';
//       return;
//     }


//     container.innerHTML = '<p class="center">Loading wishlist...</p>';
//     //debugger();




//     Promise.all(
//       wishlist.map(handle =>
//         fetch(`/products/${handle}.js`)
//           .then(res => res.ok ? res.json() : null)
//           .catch(() => null)
//       )
//     ).then(products => {

//       const validProducts = products.filter(p => p);

//       if (validProducts.length === 0) {
//         container.innerHTML = '<p>No products found</p>';
//         return;
//       }

//       container.innerHTML = validProducts.map(product => `

//         <div class="product-card grid__item left scroll-trigger animate--slide-in" data-cascade="" style="--animation-order: 2;">
//         <div class="card-wrapper product-card-wrapper underline-links-hover">
//         <div class="
//         card card--standard card--media
        
        
        
//       " style="--ratio-percent: 100%;">
//         <div class="card__inner color-scheme-2 gradient ratio">
//           <div class="card__media ">
//             <div class="media media--transparent media--hover-effect" style="padding-top:100%; position:relative;">

//   ${
//     product.images && product.images.length
//       ? `
    
//         <img
//           src="${product.images[0]}"
//           alt="${product.title}"
//           class="motion-reduce"
//           loading="lazy"
//         >

       
//         ${product.images[1] ? `
//           <img
//             src="${product.images[1]}"
//             alt="${product.title}"
//             class="motion-reduce"
//             loading="lazy"
//           >
//         ` : ''}
//       `
//       : `
       
//         <div class="placeholder-svg-wrapper">
//           ${window.dawnPlaceholder}
//         </div>
//       `
//   }

// </div>
//           </div>
//         <div class="card__content">
//             <div class="card__information">
//                 <h3 class="card__heading h5"><a class="full-unstyled-link" href="${product.url}">${product.title}</a></h3>
//                   <div class="card-information">
//                     <div class="price">
//                       <p>₹ ${(product.price / 100).toFixed(2)}</p>
//                     </div>
//                   </div>


//                 <button class="button remove-wishlist" data-handle="${product.handle}">
//                   Remove
//                 </button>
//             </div>
//                 <div class="card__badge ${window.themeSettings?.badge_position}">
  
//   ${!product.available ? `
//     <span class="badge badge--bottom-left color-${window.themeSettings?.sold_out_badge_color_scheme}">
//        ${window.themeSettings?.sold_out_text}
//     </span>
//   ` : (product.variants[0].compare_at_price > product.variants[0].price ? `
//     <span class="badge badge--bottom-left color-${window.themeSettings?.sale_badge_color_scheme}">
//       ${window.themeSettings?.sale_text}
//     </span>
//   ` : '')}

// </div>

// ${product.variants[0].compare_at_price > product.variants[0].price ? `
//   <div class="card__discount__badge ${window.themeSettings?.discount_badge_position}">
//     <span class="discount_badge color-${window.themeSettings?.discount_badge_color_scheme}">
//       ${Math.round(((product.variants[0].compare_at_price - product.variants[0].price) * 100) / product.variants[0].compare_at_price)}% off
//     </span>
//   </div>
// ` : ''}
//           </div>
//         </div>
//           <div class="card__content">
//             <div class="card__information">
//                 <h3 class="card__heading h5"><a class="full-unstyled-link" href="${product.url}">${product.title}</a></h3>
//                   <div class="card-information">
//                     <div class="price">
//                       <p>₹ ${(product.price / 100).toFixed(2)}</p>
//                     </div>
//                   </div>


//                 <button class="button remove-wishlist" data-handle="${product.handle}">
//                   Remove
//                 </button>
//             </div>

//           </div>

//         </div>
//         </div>
//         </div>
//         </div>
//       `).join('');

//     });


//     document.addEventListener('click', function(e) {
//       const btn = e.target.closest('.remove-wishlist');
//       if (!btn) return;

//       const handle = btn.dataset.handle;

//       let list = getWishlist();
//       list = list.filter(item => item !== handle);
//       saveWishlist(list);

//       btn.closest('.product-card')?.remove();


//       if (list.length === 0) {
//         container.innerHTML = '<p>No products in wishlist</p>';
//       }
//     });

//   }

// })();


// (function() {
//   const STORAGE_KEY = 'wishlistProducts';


//   function getWishlist() {
//     try {
//       return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
//     } catch {
//       return [];
//     }
//   }

//   function saveWishlist(list) {
//     localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
//   }


//   function updateWishlistCounter() {
//     const counterEl = document.querySelector('.wishlist-count');
//     if (!counterEl) return;

//     counterEl.textContent = getWishlist().length;
//   }


//   document.addEventListener('click', function(e) {
//     const btn = e.target.closest('.wishlist-btn, .remove-wishlist');
//     if (!btn) return;

//     const handle = btn.dataset.productHandle || btn.dataset.handle;
//     if (!handle) return;

//     let list = getWishlist();


//     if (btn.classList.contains('remove-wishlist')) {
//       list = list.filter(item => item !== handle);
//       btn.closest('.wishlist-item, .card-wrapper')?.remove();
//     } 

//     else {
//       if (!list.includes(handle)) {
//         list.push(handle);
//         btn.classList.add('is-active');
//       }
//     }

//     saveWishlist(list);
//     updateWishlistCounter();
//   });


//   document.addEventListener('DOMContentLoaded', updateWishlistCounter);


//   window.addEventListener('pageshow', updateWishlistCounter);


//   window.addEventListener('storage', function(e) {
//     if (e.key === STORAGE_KEY) {
//       updateWishlistCounter();
//     }
//   });

// })();


// (function() {
//   const STORAGE_KEY = 'wishlistProducts';

//   function getWishlist() {
//     try {
//       return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
//     } catch {
//       return [];
//     }
//   }

//   function saveWishlist(list) {
//     localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
//   }

//   function updateWishlistCounter() {
//     const counterEl = document.querySelector('.wishlist-count');
//     const bubble = document.querySelector('.wishlist-count-bubble');

//     if (!counterEl || !bubble) return;

//     const count = getWishlist().length;

//     counterEl.textContent = count;


//     if (count === 0) {
//       bubble.style.display = 'none';
//     } else {
//       bubble.style.display = ''; 
//     }
//   }


//   document.addEventListener('click', function(e) {
//     const btn = e.target.closest('.wishlist-btn, .remove-wishlist');
//     if (!btn) return;

//     const handle = btn.dataset.productHandle || btn.dataset.handle;
//     if (!handle) return;

//     let list = getWishlist();


//     if (btn.classList.contains('remove-wishlist')) {
//       list = list.filter(item => item !== handle);
//       const itemEl = btn.closest('.wishlist-item, .card-wrapper');
//       if (itemEl) itemEl.remove();
//     } 

//     else {
//       if (!list.includes(handle)) {
//         list.push(handle);
//         btn.classList.add('is-active');
//       }
//     }

//     saveWishlist(list);
//     updateWishlistCounter(); 
//   });


//   document.addEventListener('DOMContentLoaded', updateWishlistCounter);
//   window.addEventListener('pageshow', updateWishlistCounter);


//   window.addEventListener('storage', function(e) {
//     if (e.key === STORAGE_KEY) {
//       updateWishlistCounter();
//     }
//   });

// })();



// document.addEventListener('DOMContentLoaded', () => {

//   const grids = document.querySelectorAll('.wishlist-products.product-grid');

//   const desktopBtns = document.querySelectorAll('[data-desktop]');
//   const mobileBtns = document.querySelectorAll('[data-mobile]');


//   const pageKey = window.location.pathname;

//   const desktopKey = `gridDesktop_${pageKey}`;
//   const mobileKey = `gridMobile_${pageKey}`;


//   const savedDesktop = localStorage.getItem(desktopKey);
//   const savedMobile = localStorage.getItem(mobileKey);


//   if (savedDesktop) {
//     grids.forEach(grid => {
//       [...grid.classList].forEach(cls => {
//         if (cls.includes('-col-desktop')) {
//           grid.classList.remove(cls);
//         }
//       });
//       grid.classList.add(`grid--${savedDesktop}-col-desktop`);
//     });

//     // active button
//     document.querySelector(`[data-desktop="${savedDesktop}"]`)?.classList.add('active');
//   }


//   if (savedMobile) {
//     grids.forEach(grid => {
//       [...grid.classList].forEach(cls => {
//         if (cls.includes('tablet-down')) {
//           grid.classList.remove(cls);
//         }
//       });
//       grid.classList.add(`grid--${savedMobile}-col-tablet-down`);
//     });


//     document.querySelector(`[data-mobile="${savedMobile}"]`)?.classList.add('active');
//   }


//   desktopBtns.forEach(btn => {
//     btn.addEventListener('click', () => {
//       const value = btn.dataset.desktop;

//       localStorage.setItem(desktopKey, value);

//       grids.forEach(grid => {
//         [...grid.classList].forEach(cls => {
//           if (cls.includes('-col-desktop')) {
//             grid.classList.remove(cls);
//           }
//         });
//         grid.classList.add(`grid--${value}-col-desktop`);
//       });


//       desktopBtns.forEach(b => b.classList.remove('active'));
//       btn.classList.add('active');
//     });
//   });


//   mobileBtns.forEach(btn => {
//     btn.addEventListener('click', () => {
//       const value = btn.dataset.mobile;

//       localStorage.setItem(mobileKey, value);

//       grids.forEach(grid => {
//         [...grid.classList].forEach(cls => {
//           if (cls.includes('tablet-down')) {
//             grid.classList.remove(cls);
//           }
//         });
//         grid.classList.add(`grid--${value}-col-tablet-down`);
//       });


//       mobileBtns.forEach(b => b.classList.remove('active'));
//       btn.classList.add('active');
//     });
//   });

// });