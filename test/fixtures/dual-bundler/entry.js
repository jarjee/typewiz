export function add(a, b) {
    return a + b;
}

export function greet(name, opts) {
    return `${opts.greeting}, ${name}`;
}

if (typeof window !== 'undefined') {
    window.__runFixture = function () {
        add(1, 2);
        greet('Ada', { greeting: 'Hello' });
    };
}
