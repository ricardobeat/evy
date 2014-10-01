/* jshint asi:true, boss:true, expr:true, eqnull:true, -W058 */

//     emmy.js
//
//     Version 0.1.0
//     Ricardo Tomasi <ricardobeat@gmail.com>
//     License: MIT (http://ricardo.mit-license.org/)
//     http://github.com/ricardobeat/emmy

// Emmy is a modern EventEmitter implementation that combines
// the best from node's EventEmitter, EE2 and Backbone. In
// default sync mode it should perform better than all of the above,
// while offering a compatible API and extra features like a debug mode.

;(function(){

    var slice = Array.prototype.slice
    var _hasImmediate = (typeof setImmediate === 'function')
    var uid = 0

    // Doing this is faster and uses less memory than Function::bind
    function _bind (fn, context, args) {
        return function () {
            return fn.apply(context, args)
        }
    }

    function validateEvent (emitter, method, name) {
        if (emitter._strict == false || emitter._eventKeys && emitter._eventKeys.hasOwnProperty(name)) return
        var err = new Error(method + "(): event '" + name + "' has not been registered for emitter " + emitter.name)
        err.emitter = emitter
        throw err
    }

    function warn (message) {
        if (typeof mocha === 'object' || typeof console !== 'object' || typeof console.warn !== 'function') return
        console.warn(message)
    }

    // EventEmitter constructor
    // ------------------------------------------------------------------------

    function EventEmitter (options) {
        options || (options = {})

        this._events    = {}               // listeners attached to this emitter
        this._listening = []               // remote listeners (listenTo)
        this.context    = options.context  // default emitter context
        this.eventCount = 0
        this.name       = options.name || ++uid

        if (options.debug) {
            this._debug = true
            this._last  = { time: 0, eventCount : 0 }
        }

        if (options.strict) {
            this._strict = true
            this._eventKeys = options.events
            if (!options.events) {
                throw new Error('No events defined for emitter ' + this.name)
            }
        }

        if (options.async) {
            this.emitSync = this.emit
            this.emit     = this.emitNext
            this._async   = true
        }
    }

    // Adds a handler to the events list
    EventEmitter.prototype.addListener = function (name, fn, context) {
        this._strict && validateEvent(this, 'addListener', name)
        var handlers = this._events[name] || (this._events[name] = [])
        handlers.push(context ? { fn: fn, context: context } : fn)
        for (var i = 0; i < handlers.length; i++) {
            if (handlers[i] == null) handlers.splice(i, 1)
        }
        return this
    }

    // Add a handler that can only get called once
    EventEmitter.prototype.once = function (name, fn) {
        this._strict && validateEvent(this, 'once', name)
        var self  = this
        var fired = false
        function onceFn () {
            if (!fired) {
                fired = true
                fn.apply(this, arguments)
                self.removeListener(name, onceFn)
            }
        }
        return this.addListener(name, onceFn)
    }

    // Removes a handler from the events list
    EventEmitter.prototype.removeListener = function (name, fn, context) {
        this._strict && validateEvent(this, 'removeListener', name)
        var self     = this
        var handlers = this._events[name]
        if (name === '*') {
            if (!fn) {
                // Remove all events
                this._events = {}
            } else {
                // Remove given function from all events
                for (var _name in this._events) {
                    if (this._events.hasOwnProperty(_name)) {
                        self.removeListener(_name, fn)
                    }
                }
            }
        } else if (fn && handlers) {
            // By name and function
            // Find handlers that match the given function
            for (var i = 0; i < handlers.length; i++) {
                if (handlers[i] && (handlers[i] === fn || handlers[i].fn === fn)) {
                    // instead of calling .splice(i, 1) here, we'll
                    // set this handler to null and defer the cleanup
                    // to the next addListener call
                    handlers[i] = null
                }
            }
            // Remove event key if there are no event handlers left
            if (handlers.length === 0) {
                delete this._events[name]
            }
        } else {
            // By name only, remove all handlers for this event
            delete this._events[name]
        }
        return this
    }

    EventEmitter.prototype.emitNext = function (name) {
        this._strict && validateEvent(this, 'emitNext', name)
        var self = this, args = arguments
        var run = _bind(EventEmitter.prototype.emit, self, args)
        return _hasImmediate ? setImmediate(run) : setTimeout(run, 0)
    }

    // Calls all handlers that match the event type
    EventEmitter.prototype.emit = function (name) {
        this._strict && validateEvent(this, 'emit', name)
        var handlers = this._events[name]
        this._debug && this.tick()
        // Return early if there are no listeners for this event
        if (!handlers) return this
        for (var i = 0; i < handlers.length; i++) {
            var handler = handlers[i]
            if (!handler) continue
            var context = handler.context || this._context || this
            var fn      = handler.fn || handler
            var length  = arguments.length
            // optimize most common calls (inspired by Backbone)
            switch (length) {
                case 1: fn.call(context); break
                case 2: fn.call(context, arguments[1]); break
                case 3: fn.call(context, arguments[1], arguments[2]); break
                default:
                    // args optimization borrowed from node EventEmitter (lib/events.js)
                    var args = new Array(length - 1)
                    for (i = 1; i < length; i++) args[i - 1] = arguments[i]
                    fn.apply(context, args)
            }
        }
        return this
    }

    // For debugging purposes. Counts the number of emitted events over time
    // and calculates a running average rate for the past 2 seconds
    EventEmitter.prototype.tick = function () {
        var now  = +new Date
        var last = this._last
        this.eventCount++
        if (now - last.time > 5000) {
            this.rate = Math.floor((this.eventCount - last.eventCount) / (now - last.time) / 1000)
            this._last = { time: now, eventCount: this.eventCount }
        }
    }

    // The **proxy** method returns a function that emits $name event on the emitter that
    // created it. It also accepts a `transform` function that will be called on the event
    // data before being forwarded. Use (with caution) to create event chains / pipes.
    EventEmitter.prototype.proxy = function (name, transform) {
        var self = this
        return function () {
            var args = slice.call(arguments, 0)
            if (typeof transform === 'function') {
                args = transform.apply(null, args)
            }
            args.unshift(name)
            self.emit.apply(self, args)
        }
    }

    // Attaches a listener to another object while keeping track of all listeners added
    EventEmitter.prototype.listenTo = function (target, name, fn, context) {
        var listener = new RemoteListener(target, name, fn, context)
        listener.attach()
        this._listening.push(listener)
    }

    EventEmitter.prototype.listenToOne = function (target, name, fn, context) {
        var fired = false
        var self  = this
        var onceFn = function () {
            if (fired) return
            fired = true
            fn.apply(this, arguments)
            self.stopListening(name, onceFn)
        }
        return this.listenTo(target, name, onceFn, context)
    }

    // Remove all remote listeners
    EventEmitter.prototype.stopListening = function (target, name, fn) {
        for (var i = 0, listener; listener = this._listening[i]; i++) {
            if (listener.matches(target, name, fn)) {
                listener.detach()
            }
        }
    }

    // Remove all own & remote listeners
    EventEmitter.prototype.destroy = function () {
        this.removeListener('*')
        this.stopListening()
    }

    // RemoteListener
    // ------------------------------------------------------------------------
    // Tracks a listener added to another object, used in the .listenTo() method
    
    function RemoteListener (target, name, fn, context) {
        this.target  = target
        this.name    = name
        this.fn      = fn
        this.context = context
    }

    // Add listener to remote object
    RemoteListener.prototype.attach = function () {
        var target = this.target
        var method = target.addListener || target.on || target.bind
        method.call(target, this.name, this.fn, this.context)
        return this
    }

    // Remove listener from remote object
    RemoteListener.prototype.detach = function () {
        var target = this.target
        var method = target.removeListener || target.off || target.unbind
        method.call(target, this.name, this.fn)
        return this
    }

    // Null parameters mean "match all"
    RemoteListener.prototype.matches = function (target, name, fn) {
        return (
            (!target || target === this.target) &&
            (!name   || name === this.name) &&
            (!fn     || fn === this.fn)
        )
    }

    // Instance creation & inheritance methods
    // ------------------------------------------------------------------------
    
    // Plain .extend, copies all properties and methods to target object
    EventEmitter.extend = function (target, options) {
        EventEmitter.call(target, options)
        var proto = EventEmitter.prototype
        for (var key in proto) {
            if (!proto.hasOwnProperty(key)) continue
            target[key] = proto[key]
        }
        return target
    }

    EventEmitter.create = function (options) {
        return new EventEmitter(options)
    }

    // Method aliases
    // ------------------------------------------------------------------------
    
    var aliases = {
        on            : 'addListener',
        off           : 'removeListener',
        trigger       : 'emit',
        one           : 'once',
        publish       : 'emit',
        subscribe     : 'addListener',
        unsubscribe   : 'removeListener'
    }

    for (var key in aliases) {
        if (!aliases.hasOwnProperty(key)) continue
        EventEmitter.prototype[key] = EventEmitter.prototype[aliases[key]]
    }

    // Export commonJS / global / AMD
    // ------------------------------------------------------------------------
    
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = EventEmitter
    } else if (typeof define !== 'undefined') {
        define('Emmy', function () { return EventEmitter })
    } else {
        this.Emmy = EventEmitter
    }

}).call(this);
