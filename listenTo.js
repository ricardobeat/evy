/* jshint asi:true, boss:true, expr:true, eqnull:true, -W058 */

// evy-listen.js
//
// Extension to evy.js to manage a list of remote events.
// Implements the `.listenTo` API.

;(function(){

    function extend (EventEmitter) {    

        // .listenTo
        // ------------------------------------------------------------------------
        // The `listenTo` method attaches listeners to another object,
        // while keeping track of them for easy clean-up. The gist of the implementation
        // is handled by the `RemoteListener` objects.

        EventEmitter.prototype.listenTo = function (target, name, fn, context) {
            var ee = this._events
            var listener = new RemoteListener(target, name, fn, context)
            listener.attach()
            ee.listening.push(listener)
        }

        // .listenToOne
        // ------------------------------------------------------------------------
        // `listenToOne` is the same as above but with "once" behaviour, removing itself
        // after the first call.

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

        // .stopListening
        // ------------------------------------------------------------------------
        // Removes all remote listeners.

        EventEmitter.prototype.stopListening = function (target, name, fn) {
            var ee = this._events
            for (var i = 0, listener; listener = ee.listening[i]; i++) {
                if (listener.matches(target, name, fn)) {
                    listener.detach()
                }
            }
        }

        // .destroy
        // ------------------------------------------------------------------------
        // A shortcut for easily removing all local *and* remote listeners.

        EventEmitter.prototype.destroy = function () {
            this.removeListener('*')
            this.stopListening()
        }


        // RemoteListener
        // ------------------------------------------------------------------------

        // Internal object used by the `listenTo()` family of methods. Keeps track of all listeners added to
        // another emitter, forwarding method calls and arguments.

        function RemoteListener (target, name, fn, context) {
            this.target  = target
            this.name    = name
            this.fn      = fn
            this.context = context
        }

        // Attaches handlers to target.

        RemoteListener.prototype.attach = function () {
            var target = this.target
            var method = target.addListener || target.on || target.bind
            method.call(target, this.name, this.fn, this.context)
            return this
        }

        // Detaches handlers from target.

        RemoteListener.prototype.detach = function () {
            var target = this.target
            var method = target.removeListener || target.off || target.unbind
            method.call(target, this.name, this.fn)
            return this
        }

        // Test if listener matches the given arguments, used by `stopListening`.

        RemoteListener.prototype.matches = function (target, name, fn) {
            return (
                (!target || target === this.target) &&
                (!name   || name === this.name) &&
                (!fn     || fn === this.fn)
            )
        }
    }

    var listenTo = { extend: extend }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = listenTo
    } else if (typeof define === 'function') {
        define('evy-listenTo', listenTo)
    } else {
        extend(this.Evy)
    }

}).call(this);
