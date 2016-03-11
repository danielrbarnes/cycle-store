'use strict';

/**
 * @overview Provides a container-based storage system for cycle.js applications.
 * @author Daniel R Barnes
 */

import {Observable} from 'rxjs';
import {Broker} from 'cycle-events';

import {
    omitBy,
    forOwn,
    reduce,
    matches,
    isUndefined,
    isString,
    isEmpty,
    pull,
    trim,
    bind
} from 'lodash';

const data = new WeakMap(),
      readonlyMethods = ['set', 'delete', 'clear'];

// UTILITY METHODS

function readonlyMethod() {
    throw new Error('Ancestor Stores are read-only.');
}

function readonly(store) {
    let proxy = Object.create(store);
    readonlyMethods.forEach(method => proxy[method] = readonlyMethod);
    ['for', 'has', 'parent', 'root'].forEach(
        // rebind proxied methods so WeakMap references work
        method => proxy[method] = bind(proxy[method], store)
    );
    return proxy;
}

function getChildStore(base, childNames) {
    return reduce(childNames, (store, name) => {
        let meta = data.get(store),
            children = meta.children,
            items = meta.items,
            child = children[name];
        if (isUndefined(child) && !items.has(name)) {
            children[name] = child = new Store(store);
            store.emit(Store.Events.CREATED, {name, child});
        }
        if (isUndefined(child) || !(child instanceof Store)) {
            throw new Error('Path does not resolve to a Store.');
        }
        return child;
    }, base) || base;
}

function getPropData(base, name) {
    let names = name.split('/'),
        prop = names.pop(),
        store = getChildStore(base, names),
        items = data.get(store).items;
    return {store, prop, items};
}

function throwIfInvalidName(name) {
    if (!isString(name) || isEmpty(trim(name))) {
        throw new Error('Parameter `name` must be a non-empty string');
    }
}

/**
 * @external Broker
 * @desc The cycle-ready event broker from `cycle-events`.
 */

/**
 * Provides container-based storage for cycle.js applications.
 * @class Store
 * @inherits Broker
 * @example
 * var Store = require('cycle-store').Store,
 *     root = new Store(),
 *     data = Store.for('records');
 * Observable.combineLatest(
 *     btnSaveClicked$,
 *     data.get('saveCommand'),
 *     data.get('activeRecord')
 * ).subscribe(function doSaveRecord(_, cmd, record) {
 *     cmd.invoke(record);
 * });
 * data.set('saveRecord', new Command());
 * data.set('activeRecord', new Record());
 */
export class Store extends Broker {

    constructor(ancestor) {
        if (!isUndefined(ancestor) && !(ancestor instanceof Store)) {
            throw new Error('The argument provided must be a Store instance.');
        }
        super();
        data.set(this, {
            children: {},
            parent: ancestor,
            items: new Map()
        });
    }

    /**
     * @typedef Store~Events
     * @type {Object}
     * @property {String} SET 'item-set' - An item was added or updated.
     * @property {String} REMOVED 'item-removed' - An item was removed.
     * @property {String} CLEARED 'store-cleared' - All items were removed.
     * @property {String} CREATED 'store-added' - A new child store was created.
     */

    /**
     * @member {Store~Events} Store.Events
     * @desc An enumeration of event names used internally that external
     *  callers can also subscribe to.
     * @example
     * store.on(Store.Events.SET, function itemAdded() { ... });
     * store.on(Store.Events.REMOVED, function itemRemoved() { ... });
     */
    static get Events () {
        return {

            /**
             * @event Store#itemSet
             * @type {Object}
             * @property {String} name The name of the item added or updated.
             * @property {*} value The new value of the item.
             * @desc An item was added to or updated in the store instance.
             * @example
             * store.on(Store.Events.SET, function(data) {
             *   log.info('An item was added:', data.name, data.value);
             * });
             */
            SET: 'item-set',

            /**
             * @event Store#itemRemoved
             * @type {Object}
             * @property {String} name The name of the item removed from the store.
             * @desc An item was removed from the store.
             * @example
             * store.on(Store.Events.REMOVED, function(data) {
             *   log.info(data.name, 'was removed');
             * });
             */
            REMOVED: 'item-removed',

            /**
             * @event Store#storeCleared
             * @type {Object}
             * @desc All items were removed from the store instance.
             * @example
             * store.on(Store.Events.CLEARED, function(data) {
             *   log.info('The store has been cleared.');
             * });
             */
            CLEARED: 'store-cleared',

            /**
             * @event Store#storeCreated
             * @type {Object}
             * @property {String} name The name of the newly created store.
             * @property {Store} child The newly created store instance.
             * @desc A new nested store has been created.
             * @example
             * store.on(Store.Events.CREATED, function(data) {
             *   log.info('A new store was created:', data.name);
             *   data.store.set('created-on', Date.now());
             * });
             */
            CREATED: 'store-added'

        };
    }

    /**
     * Retrieves (and creates, if necessary) a child container within the
     * current store.
     * @function Store#for
     * @param {String} name The name of the child store to create/retrieve.
     *  You can specify nested stores by separating stores with a "/" -- see
     *  the examples for details.
     * @returns {Store}
     * @throws {Error} Parameter `name` must be a non-empty string
     * @example
     * var root = new Store(),
     *     child = root.for('child'),
     *     grandchild = child.for('child');
     * root.for('child/grandchild')) === grandchild; // true
     */
    for(name) {
        throwIfInvalidName(name);
        return getChildStore(this, name.split('/'));
    }

    /**
     * Retrieves the parent of the current store. For the root store,
     * this method returns `undefined`. NOTE: The parent store returned
     * from this method is readonly -- `set`, `clear`, and `delete`
     * will not work and will instead throw errors.
     * @function Store#parent
     * @returns {Store|undefined}
     * @example
     * if (child.parent().has('some-key')) {
     *    // ...
     * }
     */
    parent() {
        let ancestor = data.get(this).parent;
        return ancestor && readonly(ancestor);
    }

    /**
     * Retrieves the root store. NOTE: The root store returned from
     * this method is readonly -- `set`, `clear`, and `delete` will
     * not work and will instead throw errors.
     * @function Store#root
     * @returns {Store}
     * @example
     * for (let item of child.root()) {
     *     log(item.value);
     * }
     */
    root() {
        let current = this,
            ancestor = data.get(this).parent;
        while (!!ancestor) {
            current = ancestor;
            ancestor = data.get(current).parent;
        }
        return readonly(current);
    }

    /**
     * Returns `true` if the store contains the specified key;
     * otherwise, returns `false`. NOTE: This method does not
     * consider ancestor stores or child stores, only the store
     * on which it was called.
     * @function Store#has
     * @param {String} name The name of the item whose existence
     *  should be checked.
     * @returns {Boolean}
     * @throws {Error} Parameter `name` must be a non-empty string
     * @example
     * // before setting the key:
     * store.has('key'); // false
     * // after setting the key:
     * store.set('key', 'value');
     * store.has('key'); // false
     * // still returns false on child store:
     * store.for('child').has('key'); // false
     */
    has(name) {
        throwIfInvalidName(name);
        return data.get(this).items.has(name);
    }

    /**
     * Returns an Observable instance whose subscribers will be
     * notified whenever a value exists for the specified key.
     * NOTE: Once a value exists in a child store, inherited
     * value changes will no longer be sent to subscribers. In
     * other words, child store values always take precedence
     * over ancestor store values. See the examples for details.
     * @function Store#get
     * @param {String} name The name of the item whose existence
     *  should be checked.
     * @throws {Error} Parameter `name` must be a non-empty string
     * @returns {Observable} A stream of value changes for the
     *  specified key.
     * @example
     * store.get('some/child/key')
     *     .subscribe(function onNext(value) {
     *         log('current value:', value);
     *     });
     * store.set('key', 123); // current value: 123
     * store.set('some/key', 'abc'); // current value: abc
     * // changing value on store won't update the nested
     * // value because the 'some' store takes priority:
     * store.set('key', 'another'); // current value: abc
     * store.set('some/child/key', 0); // current value: 0
     * // and now that 'some/child/key' has been set, any
     * // changes made to 'some/key' will not be propagated:
     * store.set('some/key', 'nope'); // current value: 0
     */
    get(name) {
        throwIfInvalidName(name);
        let {store, items, prop} = getPropData(this, name),
            parent = data.get(store).parent,
            value = items.get(prop),
            changes$ = Observable.fromEvent(store, Store.Events.SET)
                .filter(matches({name: name}))
                .pluck('value'),
            inherit$ = (!!parent ? parent.get(prop) : Observable.empty());
        if (items.has(prop)) {
            changes$ = changes$.startWith(value);
        }
        return Observable.merge(changes$, inherit$.takeUntil(changes$));
    }

    /**
     * Adds or updates a value in the store. You can specify a nested
     * store in the name using forward slashes (/) See the examples for
     * details.
     * @function Store#set
     * @param {String} name The name of the item to set.
     * @param {*} value The value to associate with the specified key.
     * @throws {Error} Parameter `name` must be a non-empty string
     * @returns {Store} The Store instance on which `set` was called.
     * @fires Store#itemSet
     * @example
     * store.set('key', 'value');
     * @example
     * store
     *     .set('key', 'base value')
     *     .set('child/key', 'override value')
     *     .set('child/grandchild/key', 'another override value');
     */
    set(name, value) {
        throwIfInvalidName(name);
        let {store, items, prop} = getPropData(this, name);
        items.set(prop, value);
        store.emit(Store.Events.SET, {name: prop, value});
        return this;
    }

    /**
     * Removes an instance from the store. You can specify nested
     * stores using forward slashes (/) in the name. See the examples
     * for details.
     * @function Store#delete
     * @param {String} name The name of the item to delete.
     * @throws {Error} Parameter `name` must be a non-empty string
     * @fires Store#itemRemoved
     * @example
     * store.set('key', 'value');
     * store.delete('key');
     * @example
     * store.delete('child/key');
     */
    delete(name) {
        throwIfInvalidName(name);
        let {store, items, prop} = getPropData(this, name);
        if (store.has(prop)) {
            items.delete(prop);
            store.emit(Store.Events.REMOVED, {name: prop});
        }
    }

    /**
     * Removes all items in the store (and, optionally, in nested
     * stores).
     * @function Store#clear
     * @param {Boolean} [nested=false] `true` to remove all items
     *  from nested stores. Default is `false`.
     * @fires Store#storeCleared
     * @example
     * store
     *     .set('key a', 'value 1')
     *     .set('key b', 'value 2')
     *     .clear();
     */
    clear(nested) {
        let meta = data.get(this);
        meta.items.forEach((value, name, map) => {
            map.delete(name);
            this.emit(Store.Events.REMOVED, {name});
        });
        if (!!nested) {
            forOwn(meta.children, child => child.clear(true));
        }
        this.emit(Store.Events.CLEARED);
    }

}

// ALIASES

Store.prototype.remove =
Store.prototype.delete;
