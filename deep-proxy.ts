interface IProxyHandler {
    set?: Function;
    get?: Function;
    ownKeys?: Function;
    deleteProperty?: Function;
}

export function createDeepProxy<T>(obj: object, rootProxyHandler: IProxyHandler, skipRoot?: boolean): T {
    const rootObject = obj;
    let initialized = false;

    const nestedProxyHandler = {
        set: function (target: any, property: string, value: any, receiver: any): boolean {
            if (typeof value === 'object' && !value.__isProxy) {
                createNestedProxy(value);
            }

            target[property] = value;

            if (!initialized || target.__proto__.hasOwnProperty(property)) {
                return true;
            }

            if (initialized) {
                createNestedProxy(rootObject);
            }

            if (rootProxyHandler.set) {
                for (const prop in rootObject) {
                    if (deepFind(rootObject[prop], receiver)) {
                        rootProxyHandler.set(rootObject, prop, rootObject[prop], receiver);
                    }
                }
            }

            return true;
        },
        get: function (target: any, name: any, receiver: any): any {
            if (name in target && typeof target[name] === 'function') {
                let ret = (Reflect as any).get(...arguments);
                if (target instanceof Map) {
                    ret = ret.bind(target);
                }
                else {
                    ret = ret.bind(receiver);
                }
                return ret;
            }
            return target[name];
        }
    };

    const deepFindCache = new Set();
    function deepFind(source: any, target: any): boolean {
        if (typeof source === 'object' && !(source instanceof Widget)) {
            for (const prop in source) {
                if (source === target || source[prop] === target) {
                    deepFindCache.clear();
                    return true;
                }
                else {
                    if (typeof source[prop] === 'object' && prop !== '__rootNode') {
                        if (deepFindCache.has(target)) {
                            continue;
                        }
                        const found = deepFind(source[prop], target);
                        deepFindCache.add(source[prop]);
                        if (found) {
                            deepFindCache.clear();
                            return found;
                        }
                    }
                }
            }
        }
        deepFindCache.clear();
        return false;
    }

    function createNestedProxy(target: object): void {
        for (const prop in target) {
            if (shouldBeProxy(target, prop)) {
                Object.defineProperty(target[prop], '__isProxy', {
                    value: true,
                    writable: false,
                    enumerable: false
                });
                target[prop] = new Proxy(target[prop], nestedProxyHandler);
                createNestedProxy(target[prop]);
            }
            else if (Array.isArray(target[prop])) {
                let i = 0;
                for (const _ of target[prop]) {
                    if (shouldBeProxy(target[prop], i)) {
                        createNestedProxy(target[prop]);
                    }
                    i++;
                }
            }
        }
    }

    function shouldBeProxy(target: object, prop: string | number): boolean {
        return target[prop]
            && typeof target[prop] === 'object'
            && !target[prop].__isProxy
            && !(target instanceof Element)
            && !(target instanceof HTMLDocument);
    }

    createNestedProxy(obj);
    if (!skipRoot) {
        const rootProxy = new Proxy(obj, rootProxyHandler as ProxyHandler<IProxyHandler>);
        Object.defineProperty(rootProxy, '__isProxy', {
            value: true,
            writable: false,
            enumerable: false
        });
        initialized = true;
        return rootProxy as any;
    }
    else {
        return obj as any;
    }
}
