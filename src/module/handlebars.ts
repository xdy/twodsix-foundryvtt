export default function registerHandlebarsHelpers() {
    Handlebars.registerHelper('add', function(a, b) {
        return a + b;
    });

    Handlebars.registerHelper('if_all', function () {
        const args = [].slice.apply(arguments);
        const opts = args.pop();

        let { fn } = opts;
        for (let i = 0; i < args.length; ++i) {
            if (args[i]) continue;
            fn = opts.inverse;
            break;
        }
        return fn(this);
    });

    Handlebars.registerHelper('lower', function(str) {
        return String.prototype.toLowerCase.call(str ?? '');
    });

    Handlebars.registerHelper('multiply', function(a, b) {
        return a * b;
    });

    // If you need to add Handlebars helpers, here are a few useful examples:
    Handlebars.registerHelper('concat', function() {
        let outStr = '';
        for (let arg in arguments) {
            if (typeof arguments[arg] != 'object') {
                outStr += arguments[arg];
            }
        }
        return outStr;
    });
}
