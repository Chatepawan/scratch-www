const webdriver = require('selenium-webdriver');
const {PageLoadStrategy} = require('selenium-webdriver/lib/capabilities');
const chrome = require('selenium-webdriver/chrome');
const bindAll = require('lodash.bindall');
const chromedriver = require('chromedriver');
const chromedriverVersion = chromedriver.version;

const headless = process.env.SMOKE_HEADLESS || false;
const remote = process.env.SMOKE_REMOTE || false;
const ci = process.env.CI || false;
const usingCircle = process.env.CIRCLECI || false;
const buildID = process.env.CIRCLE_BUILD_NUM || '0000';
const {SAUCE_USERNAME, SAUCE_ACCESS_KEY} = process.env;
const {By, Key, until} = webdriver;

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
    }
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

    getDriver () {
        const chromeOptions = new chrome.Options();
        if (headless) {
            chromeOptions.addArguments('--headless');
        }
        chromeOptions.addArguments('window-size=1024,1680');
        chromeOptions.addArguments('--no-sandbox');
        chromeOptions.addArguments('--disable-dev-shm-using');
        chromeOptions.addArguments('--remote-debugging-port=9222');
        chromeOptions.setPageLoadStrategy(PageLoadStrategy.EAGER);
        let driver = new webdriver.Builder()
            .forBrowser('chrome')
            .withCapabilities(chromeOptions)
            .build();
        return driver;
    }

    getChromeVersionNumber () {
        const versionFinder = /\d+\.\d+/;
        const versionArray = versionFinder.exec(chromedriverVersion);
        if (versionArray === null) {
            throw new Error('couldn\'t find version of chromedriver');
        }
        return versionArray[0];
    }

    getSauceDriver (username, accessKey, name) {
        const chromeVersion = this.getChromeVersionNumber();
        // Driver configs can be generated with the Sauce Platform Configurator
        // https://wiki.saucelabs.com/display/DOCS/Platform+Configurator
        let driverConfig = {
            browserName: 'chrome',
            platform: 'macOS 10.14',
            version: chromeVersion
        };
        var driver = new webdriver.Builder()
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

    getKey (keyName) {
        return Key[keyName];
    }

    findByXpath (xpath, timeoutMessage = `findByXpath timed out for path: ${xpath}`) {
        return this.driver.wait(until.elementLocated(By.xpath(xpath)), DEFAULT_TIMEOUT_MILLISECONDS, timeoutMessage)
            .then(el => (
                this.driver.wait(el.isDisplayed(), DEFAULT_TIMEOUT_MILLISECONDS, `${xpath} is not visible`)
                    .then(() => el)
            ));
    }

    waitUntilGone (element) {
        return this.driver.wait(until.stalenessOf(element));
    }

    async waitUntilClickable (xpath) {
        return await this.driver.wait(async () => {
            let elementAtPath = await this.findByXpath(xpath);
            if (!elementAtPath) {
                return;
            }
            const rect = await elementAtPath.getRect();
            const x = rect.x + (rect.width / 2);
            const y = rect.y + (rect.height / 2);
            const elementAtPoint = await this.driver.executeScript(
                'return document.elementFromPoint(arguments[0], arguments[1])',
                x,
                y
            );
            if (!elementAtPoint) {
                return;
            }
            // If we ask to click on a button and Selenium finds an image on the button, or vice versa, that's OK.
            // It doesn't have to be an exact match.
            const match = await this.driver.executeScript(
                'return arguments[0].contains(arguments[1]) || arguments[1].contains(arguments[0])',
                elementAtPath,
                elementAtPoint
            );
            if (!match) {
                return;
            }
            if (!await elementAtPath.isDisplayed()) {
                return;
            }
            if (!await elementAtPath.isEnabled()) {
                return;
            }
            return elementAtPath;
        });
    }

    async clickXpath (xpath) {
        const element = await this.waitUntilClickable(xpath);
        element.click();
    }

    clickText (text) {
        return this.clickXpath(`//*[contains(text(), '${text}')]`);
    }

    findText (text) {
        return this.driver.wait(until.elementLocated(By.xpath(`//*[contains(text(), '${text}')]`), 5 * 1000));
    }

    clickButton (text) {
        return this.clickXpath(`//button[contains(text(), '${text}')]`);
    }

    findByCss (css) {
        return this.driver.wait(until.elementLocated(By.css(css), 1000 * 5));
    }

    clickCss (css) {
        return this.findByCss(css).then(el => el.click());
    }

    dragFromXpathToXpath (startXpath, endXpath) {
        return this.findByXpath(startXpath).then(startEl => {
            return this.findByXpath(endXpath).then(endEl => {
                return this.driver.actions()
                    .dragAndDrop(startEl, endEl)
                    .perform();
            });
        });
    }

    // must be used on a www page
    async signIn (username, password) {
        await this.clickXpath('//li[@class="link right login-item"]/a');
        let name = await this.findByXpath('//input[@id="frc-username-1088"]');
        await name.sendKeys(username);
        let word = await this.findByXpath('//input[@id="frc-password-1088"]');
        await word.sendKeys(password + this.getKey('ENTER'));
        await this.findByXpath('//span[contains(@class, "profile-name")]');
    }

    urlMatches (regex) {
        return this.driver.wait(until.urlMatches(regex), 1000 * 5);
    }

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

    async containsClass (element, cl) {
        let classes = await element.getAttribute('class');
        let classList = classes.split(' ');
        if (classList.includes(cl)){
            return true;
        }
        return false;
    }

    async waitUntilVisible (element, driver) {
        await driver.wait(until.elementIsVisible(element));
    }

}

module.exports = SeleniumHelper;
