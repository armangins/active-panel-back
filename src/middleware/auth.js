module.exports = {
    ensureAuth: function (req, res, next) {
        if (req.isAuthenticated()) {
            return next();
        }
        res.status(401).json({ error: 'Unauthorized. Please log in.' });
    },
    ensureGuest: function (req, res, next) {
        if (req.isAuthenticated()) {
            return res.redirect('/api/products'); // Or wherever you want logged-in users to go
        }
        return next();
    }
};
