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

    Handlebars.registerHelper('toLowerCase', function(str) {
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

    Handlebars.registerHelper({
        eq: (v1, v2) => v1 === v2,
        ne: (v1, v2) => v1 !== v2,
        lt: (v1, v2) => v1 < v2,
        gt: (v1, v2) => v1 > v2,
        lte: (v1, v2) => v1 <= v2,
        gte: (v1, v2) => v1 >= v2,
        and() {
            return Array.prototype.every.call(arguments, Boolean);
        },
        or() {
            return Array.prototype.slice.call(arguments, 0, -1).some(Boolean);
        }
    });
}
