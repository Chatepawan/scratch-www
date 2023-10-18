jest.setTimeout(30000); // eslint-disable-line no-undef

const webdriver = require('selenium-webdriver');
const {PageLoadStrategy} = require('selenium-webdriver/lib/capabilities');
const bindAll = require('lodash.bindall');
require('chromedriver');
const chromedriverVersion = require('chromedriver').version;

const headless = process.env.SMOKE_HEADLESS || false;
const remote = process.env.SMOKE_REMOTE || false;
const ci = process.env.CI || false;
const usingCircle = process.env.CIRCLECI || false;
const buildID = process.env.CIRCLE_BUILD_NUM || '0000';
const {SAUCE_USERNAME, SAUCE_ACCESS_KEY} = process.env;
const {By, Key, until} = webdriver;

// The main reason for this timeout is so that we can control the timeout message and report details;
// if we hit the Jasmine default timeout then we get a terse message that we can't control.
// The Jasmine default timeout is 30 seconds so make sure this is lower.
const DEFAULT_TIMEOUT_MILLISECONDS = 20 * 1000;

class SeleniumHelper {
    constructor () {
        bindAll(this, [
            'buildDriver',
            'clickButton',
            'clickCss',
            'clickText',
            'clickXpath',
            'containsClass',
            'dragFromXpathToXpath',
            'findByCss',
            'findByXpath',
            'findText',
            'getKey',
            'getDriver',
            'getLogs',
            'getSauceDriver',
            'signIn',
            'urlMatches',
            'waitUntilGone'
        ]);

        // this type declaration suppresses IDE type warnings throughout this file
        /** @type {webdriver.ThenableWebDriver} */
        this.driver = null;
    }

    /**
     * Build a new webdriver instance. This will use Sauce Labs if the SMOKE_REMOTE environment variable is 'true', or
     * `chromedriver` otherwise.
     * @param {string} name The name to give to Sauce Labs.
     * @returns {webdriver.ThenableWebDriver} The new webdriver instance.
     */
    buildDriver (name) {
        if (remote === 'true'){
            let nameToUse;
            if (ci === 'true'){
                let ciName = usingCircle ? 'circleCi ' : 'unknown ';
                nameToUse = ciName + buildID + ' : ' + name;
            } else {
                nameToUse = name;
            }
            this.driver = this.getSauceDriver(SAUCE_USERNAME, SAUCE_ACCESS_KEY, nameToUse);
        } else {
            this.driver = this.getDriver();
        }
        return this.driver;
    }

    /**
     * Build a new webdriver instance using `chromedriver`.
     * You should probably use `buildDriver` instead.
     * @returns {webdriver.ThenableWebDriver} The new webdriver instance.
     */
    getDriver () {
        const chromeCapabilities = webdriver.Capabilities.chrome();
        let args = [];
        if (headless) {
            args.push('--headless');
            args.push('window-size=1024,1680');
            args.push('--no-sandbox');
        }
        chromeCapabilities.set('chromeOptions', {args});
        chromeCapabilities.setPageLoadStrategy(PageLoadStrategy.EAGER);
        let driver = new webdriver.Builder()
            .forBrowser('chrome')
            .withCapabilities(chromeCapabilities)
            .build();
        return driver;
    }

    /**
     * @returns {string} The version of chromedriver being used.
     */
    getChromeVersionNumber () {
        const versionFinder = /\d+\.\d+/;
        const versionArray = versionFinder.exec(chromedriverVersion);
        if (versionArray === null) {
            throw new Error('couldn\'t find version of chromedriver');
        }
        return versionArray[0];
    }

    /**
     * Build a new webdriver instance using Sauce Labs.
     * You should probably use `buildDriver` instead.
     * @param {string} username The Sauce Labs username.
     * @param {string} accessKey The Sauce Labs access key.
     * @param {string} name The name to give to Sauce Labs.
     * @returns {webdriver.ThenableWebDriver} The new webdriver instance.
     */
    getSauceDriver (username, accessKey, name) {
        const chromeVersion = this.getChromeVersionNumber();
        // Driver configs can be generated with the Sauce Platform Configurator
        // https://wiki.saucelabs.com/display/DOCS/Platform+Configurator
        const driverConfig = {
            browserName: 'chrome',
            platform: 'macOS 10.15',
            version: chromeVersion
        };
        const driver = new webdriver.Builder()
            .withCapabilities({
                browserName: driverConfig.browserName,
                platform: driverConfig.platform,
                version: driverConfig.version,
                username: username,
                accessKey: accessKey,
                name: name
            })
            .usingServer(`http://${username}:${accessKey
            }@ondemand.saucelabs.com:80/wd/hub`)
            .build();
        return driver;
    }

    /**
     * Retrieves a key string by name.
     * @example
     * getKey('ENTER') // => '\uE007'
     * @param {string} keyName The name of the key to retrieve.
     * @returns {string} The key.
     */
    getKey (keyName) {
        return Key[keyName];
    }

    /**
     * Find an element by xpath.
     * @param {string} xpath The xpath to search for.
     * @param {string} timeoutMessage The message to use if the operation times out.
     * @returns {Promise<webdriver.WebElement>} A promise that resolves to the element.
     */
    findByXpath (xpath, timeoutMessage = `findByXpath timed out for path: ${xpath}`) {
        return this.driver.wait(until.elementLocated(By.xpath(xpath)), DEFAULT_TIMEOUT_MILLISECONDS, timeoutMessage)
            .then(el => (
                this.driver.wait(el.isDisplayed(), DEFAULT_TIMEOUT_MILLISECONDS, `${xpath} is not visible`)
                    .then(() => el)
            ));
    }

    /**
     * @param {webdriver.WebElement} element Wait until this element is gone (stale).
     * @returns {Promise} A promise that resolves when the element is gone.
     */
    waitUntilGone (element) {
        return this.driver.wait(until.stalenessOf(element));
    }

    /**
     * Wait until an element can be found by the provided xpath, then click on it.
     * @param {string} xpath The xpath to click.
     * @returns {Promise<void>} A promise that resolves when the element is clicked.
     */
    clickXpath (xpath) {
        return this.findByXpath(xpath).then(el => el.click());
    }

    /**
     * Wait until an element can be found by the provided text, then click on it.
     * @param {string} text The text to click.
     * @returns {Promise<void>} A promise that resolves when the element is clicked.
     */
    clickText (text) {
        return this.clickXpath(`//*[contains(text(), '${text}')]`);
    }

    /**
     * Wait until an element can be found by the provided text.
     * @param {string} text The text to find.
     * @returns {Promise<webdriver.WebElement>} The element containing the text.
     */
    findText (text) {
        return this.driver.wait(until.elementLocated(By.xpath(`//*[contains(text(), '${text}')]`), 5 * 1000));
    }

    /**
     * Wait until a button can be found by the provided text, then click on it.
     * @param {string} text The button text to find and click.
     * @returns {Promise} A promise that resolves when the button is clicked.
     */
    clickButton (text) {
        return this.clickXpath(`//button[contains(text(), '${text}')]`);
    }

    /**
     * Wait until an element can be found by the provided CSS selector.
     * @param {string} css The CSS selector to find.
     * @returns {Promise<webdriver.WebElement>} The element matching the CSS selector.
     */
    findByCss (css) {
        return this.driver.wait(until.elementLocated(By.css(css), 1000 * 5));
    }

    /**
     * Wait until an element can be found by the provided CSS selector, then click on it.
     * @param {string} css The CSS selector to find and click.
     * @returns {Promise} A promise that resolves when the element is clicked.
     */
    clickCss (css) {
        return this.findByCss(css).then(el => el.click());
    }

    /**
     * Wait until the two elements can be found, then drag from the first to the second.
     * @param {string} startXpath The xpath to drag from.
     * @param {string} endXpath The xpath to drag to.
     * @returns {Promise} A promise that resolves when the drag is complete.
     */
    dragFromXpathToXpath (startXpath, endXpath) {
        return this.findByXpath(startXpath).then(startEl => {
            return this.findByXpath(endXpath).then(endEl => {
                return this.driver.actions()
                    .dragAndDrop(startEl, endEl)
                    .perform();
            });
        });
    }

    /**
     * Sign in on a `scratch-www` page.
     * @param {string} username The username to sign in with.
     * @param {string} password The password to sign in with.
     * @returns {Promise} A promise that resolves when the user is signed in.
     */
    async signIn (username, password) {
        await this.clickXpath('//li[@class="link right login-item"]/a');
        let name = await this.findByXpath('//input[@id="frc-username-1088"]');
        await name.sendKeys(username);
        let word = await this.findByXpath('//input[@id="frc-password-1088"]');
        await word.sendKeys(password + this.getKey('ENTER'));
        await this.findByXpath('//span[contains(@class, "profile-name")]');
    }

    /**
     * Wait until the URL matches the provided regex.
     * @param {RegExp} regex The regex to match the url against.
     * @returns {Promise} A promise that resolves when the url matches the regex.
     */
    urlMatches (regex) {
        return this.driver.wait(until.urlMatches(regex), 1000 * 5);
    }

    /**
     * Get selected browser log entries.
     * @param {Array<string>} [whitelist] An optional list of log strings to allow. Default: see implementation.
     * @returns {Promise<Array<webdriver.logging.Entry>>} A promise that resolves to the log entries.
     */
    getLogs (whitelist) {
        return this.driver.manage()
            .logs()
            .get('browser')
            .then((entries) => {
                return entries.filter((entry) => {
                    const message = entry.message;
                    for (let i = 0; i < whitelist.length; i++) {
                        if (message.indexOf(whitelist[i]) !== -1) {
                            // eslint-disable-next-line no-console
                            // console.warn('Ignoring whitelisted error: ' + whitelist[i]);
                            return false;
                        } else if (entry.level !== 'SEVERE') {
                            // eslint-disable-next-line no-console
                            // console.warn('Ignoring non-SEVERE entry: ' + message);
                            return false;
                        }
                        return true;
                    }
                    return true;
                });
            });
    }

    /**
     * Check if an element's class attribute contains a given class.
     * @param {webdriver.WebElement} element The element to check.
     * @param {string} cl The class to check for.
     * @returns {Promise<boolean>} True if the element's class attribute contains the given class, false otherwise.
     */
    async containsClass (element, cl) {
        let classes = await element.getAttribute('class');
        let classList = classes.split(' ');
        if (classList.includes(cl)){
            return true;
        }
        return false;
    }

    /**
     * @param {webdriver.WebElement} element Wait until this element is visible.
     * @param {webdriver.ThenableWebDriver} driver The webdriver instance.
     * @returns {Promise} A promise that resolves when the element is visible.
     */
    async waitUntilVisible (element, driver) {
        await driver.wait(until.elementIsVisible(element));
    }

}

module.exports = SeleniumHelper;
