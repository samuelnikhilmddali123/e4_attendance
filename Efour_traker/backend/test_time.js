const { getISTTime } = require('./controllers/utilsController');

try {
    const time = getISTTime();
    console.log('IST Time Success:', time);
} catch (err) {
    console.error('IST Time Failure:', err);
}
