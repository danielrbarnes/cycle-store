'use strict';

var _ = require('lodash');
var expect = require('chai').expect;
var Store = require('../index').Store;

var invalidNames = ['', ' ', 123, null, NaN, /rx/, new Date()];

function checkThrow(method) {
    _.forEach(invalidNames, function(name) {
        expect(function() {
            method(name);
        }).to.throw('Parameter `name` must be a non-empty string');
    });
}

function checkThrowInvalidPath() {}

describe('Store', function() {

    /* jshint -W030 */

    beforeEach(function createInstance() {
        this.store = new Store();
    });

    it('is instance of Broker', function() {
        expect(this.store.on).to.be.a('function');
        expect(this.store.off).to.be.a('function');
    });

    it('nests store if parent provided', function() {
        var child = new Store(this.store);
        expect(Object.getPrototypeOf(child.parent())).to.equal(this.store);
    });

    it('throws if parent not a Store instance', function() {
        expect(function() {
            new Store({});
        }).to.throw('The argument provided must be a Store instance.');
    });

    describe('fires lifecycle events:', function() {

        it('item-set', function(done) {
            this.store.on('item-set', function(data) {
                expect(data.name).to.equal('key');
                expect(data.value).to.equal('value');
                done();
            });
            this.store.set('key', 'value');
        });

        it('item-removed', function(done) {
            this.store.on('item-removed', function(data) {
                expect(data.name).to.equal('key');
                done();
            });
            this.store.set('key', 123);
            this.store.delete('key');
        });

        it('store-added', function(done) {
            this.store.on('store-added', function(data) {
                expect(data.name).to.equal('child');
                expect(data.child).to.be.an.instanceof(Store);
                done();
            });
            this.store.set('child/key', Date.now());
        });

        it('store-cleared', function(done) {
            this.store.on('store-cleared', function(data) {
                expect(data).to.be.undefined;
                done();
            });
            this.store.clear();
        });

    });

    describe('.for', function() {

        it('throws if name invalid', function() {
            checkThrow(this.store.for);
        });

        it('throws if path not to a store', function() {
            var store = this.store.set('child/value', 123);
            expect(function() {
                store.for('child/value');
            }).to.throw('Path does not resolve to a Store.');
        });

        it('creates nested store', function() {
            var child = this.store.for('child');
            expect(Object.getPrototypeOf(child.parent())).to.equal(this.store);
        });

        it('creates multiple nested stores', function() {
            var child = this.store.for('child'),
                grandchild = this.store.for('child/grandchild');
            expect(Object.getPrototypeOf(child.parent())).to.equal(this.store);
            expect(Object.getPrototypeOf(grandchild.parent())).to.equal(child);
        });

        it('does not overwrite existing children', function() {
            var child = this.store.for('child'),
                grandchild = this.store.for('child/grandchild');
            expect(Object.getPrototypeOf(grandchild.parent())).to.equal(child);
        });

    });

    describe('.parent', function() {

        it('returns parent Store', function() {
            var child = new Store(this.store);
            expect(Object.getPrototypeOf(child.parent())).to.equal(this.store);
        });

        it('is readonly', function() {
            var child = new Store(this.store);
            ['set', 'clear', 'delete'].forEach(function(method) {
                expect(function() {
                    child.parent()[method]('key', 'value');
                }).to.throw('Ancestor Stores are read-only.');
            });
        });

    });

    describe('.root', function() {

        it('returns root Store', function() {
            var child = new Store(this.store),
                grandchild = new Store(child);
            expect(Object.getPrototypeOf(grandchild.root())).to.equal(this.store);
        });

        it('is readonly', function() {
            var child = new Store(this.store),
                grandchild = new Store(child);
            ['set', 'clear', 'delete'].forEach(function(method) {
                expect(function() {
                    grandchild.root()[method]('key', 'value');
                }).to.throw('Ancestor Stores are read-only.');
            });
        });

    });

    describe('.get', function() {

        it('throws if name invalid', function() {
            checkThrow(this.store.get);
        });

        it('returns Observable', function() {
            var observable = this.store.get('key');
            expect(observable.subscribe).to.be.a('function');
        });

        it('creates child stores if necessary', function() {
            var observable = this.store.get('dne/key');
            expect(observable.subscribe).to.be.a('function');
        });

        it('gives ancestor value if immediate does not exist', function(done) {
            this.store.set('key', 'value')
                .for('child')
                .get('key')
                .subscribe(function onNext(value) {
                    expect(value).to.equal('value');
                    done();
                });
        });

        it('gives immediate value over ancestor value if both exist', function(done) {
            this.store.set('key', 'parent-value')
                .for('child')
                .set('key', 'child-value')
                .get('key')
                .subscribe(function onNext(value) {
                    expect(value).to.equal('child-value');
                    done();
                });
        });

        it('gives value if first one set on ancestor after subscribe', function(done) {
            var child = this.store.for('child');
            child.get('key').subscribe(function onNext(value) {
                expect(value).to.equal('value');
                done();
            });
            this.store.set('key', 'value');
        });

        it('gives value if first one set on immediate after subscribe', function(done) {
            this.store.get('key')
                .subscribe(function onNext(value) {
                    expect(value).to.equal('value');
                    done();
                });
            this.store.set('key', 'value');
        });

        it('gives values in ancestor until immediate has a value', function(done) {
            var index = 0,
                expects = ['a', 'b', 'c', 'd', 'g'],
                child = this.store.for('child');
            child.get('key').subscribe(function onNext(value) {
                expect(value).to.equal(expects[index++]);
                if (index >= expects.length) {
                    done();
                }
            });
            this.store.set('key', 'a');
            this.store.set('key', 'b');
            this.store.set('key', 'c');
            child.set('key', 'd');
            this.store.set('key', 'e');
            this.store.set('key', 'f');
            child.set('key', 'g');
        });

        it('values in imediate have priority over ancestor values', function(done) {
            var callCount = 0,
                child = this.store.for('child');
            child.get('key').subscribe(function onNext(value) {
                expect(value).to.equal(callCount++);
                if (callCount >= 3) {
                    done();
                }
            });
            child.set('key', 0);
            child.set('key', 1);
            this.store.set('key', 3);
            this.store.set('key', 4);
            this.store.set('key', 5);
            child.set('key', 2);
        });

        it('subscribers receive immediate value over ancestor value', function(done) {
            this.store.set('key', 'parent')
                .for('child')
                .set('key', 'child')
                .get('key')
                .subscribe(function onNext(value) {
                    expect(value).to.equal('child');
                    done();
                });
        });

    });

    describe('.set', function() {

        it('returns reference to store for chaining', function() {
            expect(this.store.set('key', 'value')).to.equal(this.store);
        });

        it('throws if name invalid', function() {
            checkThrow(this.store.set);
        });

        it('throws if path not to a store', function() {
            var store = this.store.set('child/value', 123);
            expect(function() {
                store.set('child/value/key', 'abc');
            }).to.throw('Path does not resolve to a Store.');
        });

        it('emits item-set event with name and value', function(done) {
            this.store.subscribe('item-set', function(e) {
                expect(e.name).to.equal('key');
                expect(e.value).to.equal('value');
                done();
            });
            this.store.set('key', 'value');
        });

        it('only emits item-set event on nested store', function(done) {
            this.store.subscribe('item-set', function() {
                expect.fail('not called', 'called');
            });
            this.store.for('child').subscribe('item-set', function() {
                done();
            });
            this.store.set('child/key', 'value');
        });

    });

    describe('has', function() {

        it('throws if name invalid', function() {
            checkThrow(this.store.has);
        });

        it('returns false if item does not exist', function() {
            expect(this.store.has('dne')).to.equal(false);
        });

        it('returns true if item exists', function() {
            expect(this.store.set('key', 'value').has('key')).to.equal(true);
        });

        it('returns false if item is in ancestor', function() {
            expect(this.store.set('key', 'value')
                .for('child').has('key')).to.equal(false);
        });

        it('returns false if item is in child', function() {
            expect(this.store.for('child').set('key', 'value')
                .parent().has('key')).to.equal(false);
        });

    });

    describe('.delete', function() {

        it('throws if name invalid', function() {
            checkThrow(this.store.delete);
        });

        it('throws if path not to a store', function() {
            var store = this.store.set('child/value', 123);
            expect(function() {
                store.delete('child/value/key');
            }).to.throw('Path does not resolve to a Store.');
        });

        it('removes item from immediate store', function() {
            expect(this.store.set('key', 'value').has('key')).to.equal(true);
            this.store.delete('key');
            expect(this.store.has('key')).to.equal(false);
        });

        it('removes item from child store', function() {
            this.store.set('child/key', 'value');
            expect(this.store.for('child').has('key')).to.equal(true);
            this.store.delete('child/key');
            expect(this.store.for('child').has('key')).to.equal(false);
        });

        it('emits item-removed event', function(done) {
            var child = this.store.for('child').set('key', 'value');
            this.store.on('item-removed', function() {
                expect.fail('not called', 'called');
            });
            child.on('item-removed', function(e) {
                expect(e.name).to.equal('key');
                done();
            });
            this.store.delete('child/key');
        });

    });

    describe('.clear', function() {

        it('removes all items in the store', function() {
            this.store.set('a', 1)
                .set('b', 2)
                .set('c', 3);
            expect(this.store.has('a')).to.equal(true);
            expect(this.store.has('b')).to.equal(true);
            expect(this.store.has('c')).to.equal(true);
            this.store.clear();
            expect(this.store.has('a')).to.equal(false);
            expect(this.store.has('b')).to.equal(false);
            expect(this.store.has('c')).to.equal(false);
        });

        it('emits item-removed event for each item', function(done) {
            var callCount = 0;
            this.store.for('child').on('item-removed', function(e) {
                expect(Number(e.name)).to.eql(callCount);
                if (++callCount >= 3) {
                    done();
                }
            });
            this.store.on('item-removed', function() {
                expect.fail('called', 'not called');
            });
            this.store.for('child')
                .set('0', 'abc')
                .set('1', 'def')
                .set('2', 'ghi')
                .clear();
        });

        it('emits store-cleared event', function(done) {
            this.store.on('store-cleared', function() {
                done();
            });
            this.store.clear();
        });

        it('calls clear on all nested stores if nested is truthy', function(done) {
            var clearCount = 0,
                callback = function() {
                    if (++clearCount === 4) {
                        done();
                    }
                },
                child1 = this.store.for('child1'),
                child2 = this.store.for('child2'),
                grandchild = child2.for('grandchild');
            child1.on('store-cleared', callback);
            child2.on('store-cleared', callback);
            grandchild.on('store-cleared', callback);
            this.store.on('store-cleared', callback);
            this.store.clear(true);
        });

    });

});
