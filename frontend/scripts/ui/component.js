export function el(tag, options = {}) {
    const {
        className,
        text,
        html,
        attrs,
        dataset,
        children = [],
        on,
    } = options;

    const node = document.createElement(tag);

    if (className) node.className = className;
    if (typeof text === 'string') node.textContent = text;
    if (typeof html === 'string') node.innerHTML = html;

    if (attrs) {
        Object.entries(attrs).forEach(([name, value]) => {
            if (value !== undefined && value !== null) {
                node.setAttribute(name, String(value));
            }
        });
    }

    if (dataset) {
        Object.entries(dataset).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                node.dataset[key] = String(value);
            }
        });
    }

    if (on) {
        Object.entries(on).forEach(([eventName, handler]) => {
            if (typeof handler === 'function') {
                node.addEventListener(eventName, handler);
            }
        });
    }

    append(node, children);
    return node;
}

export function append(parent, children) {
    const items = Array.isArray(children) ? children : [children];

    items.forEach((child) => {
        if (child === null || child === undefined || child === false) return;
        if (typeof child === 'string' || typeof child === 'number') {
            parent.appendChild(document.createTextNode(String(child)));
            return;
        }
        parent.appendChild(child);
    });
}

export function clear(node) {
    node.replaceChildren();
}

export function render(target, children) {
    clear(target);
    append(target, children);
}
