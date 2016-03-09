# cycle-store
Provides nestable storage containers for cycle.js applications.

## Installation
`npm i cycle-store --save`

## Scripts
NOTE: Make sure you've installed all dependencies using `npm install` first.

To generate documentation: `npm run doc`. This will create documentation in the
`build/docs` folder.

To run unit tests: `npm test`

## API
### Store
**Kind**: global class  
**Inherits**: Broker  

* [Store](#Store)
    * [new Store()](#new_Store_new)
    * _instance_
        * [.for(name)](#Store+for) ⇒ <code>[Store](#Store)</code>
        * [.parent()](#Store+parent) ⇒ <code>[Store](#Store)</code> &#124; <code>undefined</code>
        * [.root()](#Store+root) ⇒ <code>[Store](#Store)</code>
        * [.has(name)](#Store+has) ⇒ <code>Boolean</code>
        * [.get(name)](#Store+get) ⇒ <code>Observable</code>
        * [.set(name, value)](#Store+set) ⇒ <code>[Store](#Store)</code>
        * [.delete(name)](#Store+delete)
        * [.clear([nested])](#Store+clear)
        * ["itemSet"](#Store+event_itemSet)
        * ["itemRemoved"](#Store+event_itemRemoved)
        * ["storeCleared"](#Store+event_storeCleared)
        * ["storeCreated"](#Store+event_storeCreated)
    * _static_
        * [.Events](#Store.Events) : <code>[Events](#Store..Events)</code>
    * _inner_
        * [~Events](#Store..Events) : <code>Object</code>

<a name="new_Store_new"></a>
### new Store()
Provides container-based storage for cycle.js applications.

**Example**  
```js
var Store = require('cycle-store').Store,    root = new Store(),    data = Store.for('records');Observable.combineLatest(    btnSaveClicked$,    data.get('saveCommand'),    data.get('activeRecord')).subscribe(function doSaveRecord(_, cmd, record) {    cmd.invoke(record);});data.set('saveRecord', new Command());data.set('activeRecord', new Record());
```
<a name="Store+for"></a>
### store.for(name) ⇒ <code>[Store](#Store)</code>
Retrieves (and creates, if necessary) a child container within thecurrent store.

**Kind**: instance method of <code>[Store](#Store)</code>  
**Throws**:

- <code>Error</code> Parameter `name` must be a non-empty string


| Param | Type | Description |
| --- | --- | --- |
| name | <code>String</code> | The name of the child store to create/retrieve.  You can specify nested stores by separating stores with a "/" -- see  the examples for details. |

**Example**  
```js
var root = new Store(),    child = root.for('child'),    grandchild = child.for('child');root.for('child/grandchild')) === grandchild; // true
```
<a name="Store+parent"></a>
### store.parent() ⇒ <code>[Store](#Store)</code> &#124; <code>undefined</code>
Retrieves the parent of the current store. For the root store,this method returns `undefined`. NOTE: The parent store returnedfrom this method is readonly -- `set`, `clear`, and `delete`will not work and will instead throw errors.

**Kind**: instance method of <code>[Store](#Store)</code>  
**Example**  
```js
if (child.parent().has('some-key')) {   // ...}
```
<a name="Store+root"></a>
### store.root() ⇒ <code>[Store](#Store)</code>
Retrieves the root store. NOTE: The root store returned fromthis method is readonly -- `set`, `clear`, and `delete` willnot work and will instead throw errors.

**Kind**: instance method of <code>[Store](#Store)</code>  
**Example**  
```js
for (let item of child.root()) {    log(item.value);}
```
<a name="Store+has"></a>
### store.has(name) ⇒ <code>Boolean</code>
Returns `true` if the store contains the specified key;otherwise, returns `false`. NOTE: This method does notconsider ancestor stores or child stores, only the storeon which it was called.

**Kind**: instance method of <code>[Store](#Store)</code>  
**Throws**:

- <code>Error</code> Parameter `name` must be a non-empty string


| Param | Type | Description |
| --- | --- | --- |
| name | <code>String</code> | The name of the item whose existence  should be checked. |

**Example**  
```js
// before setting the key:store.has('key'); // false// after setting the key:store.set('key', 'value');store.has('key'); // false// still returns false on child store:store.for('child').has('key'); // false
```
<a name="Store+get"></a>
### store.get(name) ⇒ <code>Observable</code>
Returns an Observable instance whose subscribers will benotified whenever a value exists for the specified key.NOTE: Once a value exists in a child store, inheritedvalue changes will no longer be sent to subscribers. Inother words, child store values always take precedenceover ancestor store values. See the examples for details.

**Kind**: instance method of <code>[Store](#Store)</code>  
**Returns**: <code>Observable</code> - A stream of value changes for the specified key.  
**Throws**:

- <code>Error</code> Parameter `name` must be a non-empty string


| Param | Type | Description |
| --- | --- | --- |
| name | <code>String</code> | The name of the item whose existence  should be checked. |

**Example**  
```js
store.get('some/child/key')    .subscribe(function onNext(value) {        log('current value:', value);    });store.set('key', 123); // current value: 123store.set('some/key', 'abc'); // current value: abc// changing value on store won't update the nested// value because the 'some' store takes priority:store.set('key', 'another'); // current value: abcstore.set('some/child/key', 0); // current value: 0// and now that 'some/child/key' has been set, any// changes made to 'some/key' will not be propagated:store.set('some/key', 'nope'); // current value: 0
```
<a name="Store+set"></a>
### store.set(name, value) ⇒ <code>[Store](#Store)</code>
Adds or updates a value in the store. You can specify a nestedstore in the name using forward slashes (/) See the examples fordetails.

**Kind**: instance method of <code>[Store](#Store)</code>  
**Returns**: <code>[Store](#Store)</code> - The Store instance on which `set` was called.  
**Throws**:

- <code>Error</code> Parameter `name` must be a non-empty string

**Emits**: <code>[itemSet](#Store+event_itemSet)</code>  

| Param | Type | Description |
| --- | --- | --- |
| name | <code>String</code> | The name of the item to set. |
| value | <code>\*</code> | The value to associate with the specified key. |

**Example**  
```js
store.set('key', 'value');
```
**Example**  
```js
store    .set('key', 'base value')    .set('child/key', 'override value')    .set('child/grandchild/key', 'another override value');
```
<a name="Store+delete"></a>
### store.delete(name)
Removes an instance from the store. You can specify nestedstores using forward slashes (/) in the name. See the examplesfor details.

**Kind**: instance method of <code>[Store](#Store)</code>  
**Throws**:

- <code>Error</code> Parameter `name` must be a non-empty string

**Emits**: <code>[itemRemoved](#Store+event_itemRemoved)</code>  

| Param | Type | Description |
| --- | --- | --- |
| name | <code>String</code> | The name of the item to delete. |

**Example**  
```js
store.set('key', 'value');store.delete('key');
```
**Example**  
```js
store.delete('child/key');
```
<a name="Store+clear"></a>
### store.clear([nested])
Removes all items in the store (and, optionally, in nestedstores).

**Kind**: instance method of <code>[Store](#Store)</code>  
**Emits**: <code>[storeCleared](#Store+event_storeCleared)</code>  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [nested] | <code>Boolean</code> | <code>false</code> | `true` to remove all items  from nested stores. Default is `false`. |

**Example**  
```js
store    .set('key a', 'value 1')    .set('key b', 'value 2')    .clear();
```
<a name="Store+event_itemSet"></a>
### "itemSet"
An item was added to or updated in the store instance.

**Kind**: event emitted by <code>[Store](#Store)</code>  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| name | <code>String</code> | The name of the item added or updated. |
| value | <code>\*</code> | The new value of the item. |

**Example**  
```js
store.on(Store.Events.SET, function(data) {  log.info('An item was added:', data.name, data.value);});
```
<a name="Store+event_itemRemoved"></a>
### "itemRemoved"
An item was removed from the store.

**Kind**: event emitted by <code>[Store](#Store)</code>  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| name | <code>String</code> | The name of the item removed from the store. |

**Example**  
```js
store.on(Store.Events.REMOVED, function(data) {  log.info(data.name, 'was removed');});
```
<a name="Store+event_storeCleared"></a>
### "storeCleared"
All items were removed from the store instance.

**Kind**: event emitted by <code>[Store](#Store)</code>  
**Example**  
```js
store.on(Store.Events.CLEARED, function(data) {  log.info('The store has been cleared.');});
```
<a name="Store+event_storeCreated"></a>
### "storeCreated"
A new nested store has been created.

**Kind**: event emitted by <code>[Store](#Store)</code>  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| name | <code>String</code> | The name of the newly created store. |
| child | <code>[Store](#Store)</code> | The newly created store instance. |

**Example**  
```js
store.on(Store.Events.CREATED, function(data) {  log.info('A new store was created:', data.name);  data.store.set('created-on', Date.now());});
```
<a name="Store.Events"></a>
### Store.Events : <code>[Events](#Store..Events)</code>
An enumeration of event names used internally that external callers can also subscribe to.

**Kind**: static property of <code>[Store](#Store)</code>  
**Example**  
```js
store.on(Store.Events.SET, function itemAdded() { ... });store.on(Store.Events.REMOVED, function itemRemoved() { ... });
```
<a name="Store..Events"></a>
### Store~Events : <code>Object</code>
**Kind**: inner typedef of <code>[Store](#Store)</code>  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| SET | <code>String</code> | 'item-set' - An item was added or updated. |
| REMOVED | <code>String</code> | 'item-removed' - An item was removed. |
| CLEARED | <code>String</code> | 'store-cleared' - All items were removed. |
| CREATED | <code>String</code> | 'store-added' - A new child store was created. |

