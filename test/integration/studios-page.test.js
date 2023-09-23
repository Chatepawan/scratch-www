// These tests sign in with user #2 and user #3

import SeleniumHelper from './selenium-helpers.js';

const {
    buildDriver,
    clickText,
    clickXpath,
    findByXpath,
    isSignedIn,
    navigate,
    signIn
} = new SeleniumHelper();

let rootUrl = process.env.ROOT_URL || 'https://scratch.ly';
let studioId = process.env.TEST_STUDIO_ID || 10004360;
let studioUrl = rootUrl + '/studios/' + studioId;
let myStuffURL = rootUrl + '/mystuff';
let rateLimitCheck = process.env.RATE_LIMIT_CHECK || rootUrl;

// since the usernames end in 2 and 3 we're using username2 and username3
// username 1 is used in other tests.  Hopefully this is not confusing.
let username2 = process.env.SMOKE_USERNAME + '2';
let username3 = process.env.SMOKE_USERNAME + '3';
let password = process.env.SMOKE_PASSWORD;

let promoteStudioURL;
let curatorTab;

jest.setTimeout(70000);

let driver;

describe('studio page while signed out', () => {
    beforeAll(async () => {
        // expect(projectUrl).toBe(defined);
        driver = await buildDriver('www-integration studio-page signed out');
    });

    beforeEach(async () => {
        await navigate(studioUrl);
        let studioNav = await findByXpath('//div[@class="studio-tabs"]');
        await studioNav.isDisplayed();
    });

    afterAll(async () => await driver.quit());

    test('land on projects tab', async () => {
        await navigate(studioUrl);
        let projectGrid = await findByXpath('//div[@class="studio-projects-grid"]');
        let projectGridDisplayed = await projectGrid.isDisplayed();
        expect(projectGridDisplayed).toBe(true);
    });

    test('studio title', async () => {
        let studioTitle = await findByXpath('//div[@class="studio-title"]');
        let titleText = await studioTitle.getText();
        expect(titleText).toEqual('studio for automated testing');
    });

    test('studio description', async () => {
        let xpath = '//div[contains(@class, "studio-description")]';
        let studioDescription = await findByXpath(xpath);
        let descriptionText = await studioDescription.getText();
        expect(descriptionText).toEqual('a description');
    });
});

describe('studio management', () => {
    // These tests all start on the curators tab of a studio and signed out

    beforeAll(async () => {
        driver = await buildDriver('www-integration studio management');
        await navigate(rootUrl);

        // create a studio for tests
        await signIn(username2, password);
        await findByXpath('//span[contains(@class, "profile-name")]');
        await navigate(rateLimitCheck);
        await navigate(myStuffURL);
        await clickXpath('//form[@id="new_studio"]/button[@type="submit"]');
        await findByXpath('//div[@class="studio-tabs"]');
        promoteStudioURL = await driver.getCurrentUrl();
        curatorTab = promoteStudioURL + 'curators';
    });

    beforeEach(async () => {
        if (await isSignedIn()) {
            await clickXpath('//a[contains(@class, "user-info")]');
            await clickText('Sign out');
        }
    });

    afterAll(async () => await driver.quit());

    test('invite a curator', async () => {
        // sign in as user2
        await signIn(username2, password);
        await navigate(curatorTab);

        // invite user3 to curate
        let inviteBox = await findByXpath('//div[@class="studio-adder-row"]/input');
        await inviteBox.sendKeys(username3);
        await clickXpath('//div[@class="studio-adder-row"]/button');
        let inviteAlert = await findByXpath('//div[@class="alert-msg"]'); // the confirm alert
        let alertText = await inviteAlert.getText();
        let successText = `Curator invite sent to "${username3}"`;
        expect(alertText).toMatch(successText);
    });

    test('accept curator invite', async () => {
        // Sign in user3
        await signIn(username3, password);
        await navigate(curatorTab);

        // accept the curator invite
        await clickXpath('//button[@class="studio-invitation-button button"]');
        let acceptSuccess = await findByXpath('//div[contains(@class,"studio-info-box-success")]');
        let acceptSuccessVisible = await acceptSuccess.isDisplayed();
        expect(acceptSuccessVisible).toBe(true);
    });

    test('promote to manager', async () => {
        // sign in as user2
        await signIn(username2, password);
        await findByXpath('//span[contains(@class, "profile-name")]');
        // for some reason the user isn't showing up without waiting and reloading the page
        await driver.sleep(2000);
        await navigate(curatorTab);

        // promote user3
        let user3href = '/users/' + username3;
        // click kebab menu on the user tile
        let kebabMenuXpath = `//a[@href = "${user3href}"]/` +
            'following-sibling::div[@class="overflow-menu-container"]';
        await clickXpath(kebabMenuXpath + '/button[@class="overflow-menu-trigger"]');
        // click promote
        // await clickXpath('//button[@class="promote-menu-button"]'); //<-- I think this will do it
        await clickXpath(kebabMenuXpath + '/ul/li/button/span[contains(text(), "Promote")]/..');
        await findByXpath('//div[@class="promote-content"]');
        // await clickXpath(//button[contains(@class="promote-button")]) <-- add this selector to the button
        await clickXpath('//div[@class="promote-button-row"]/button/span[contains(text(),"Promote")]/..');
        let promoteSuccess = await findByXpath('//div[contains(@class, "alert-success")]');
        let promoteSuccessVisible = await promoteSuccess.isDisplayed();
        expect(promoteSuccessVisible).toBe(true);
    });

    test('transfer studio host', async () => {
        // sign in as user2
        await signIn(username2, password);
        await findByXpath('//span[contains(@class, "profile-name")]');
        // for some reason the user isn't showing up without reloading the page
        await navigate(curatorTab);

        // open kebab menu
        let user2href = '/users/' + username2;
        // click kebab menu on the user tile
        let kebabMenuXpath = `//a[@href = "${user2href}"]/` +
            'following-sibling::div[@class="overflow-menu-container"]';
        await clickXpath(kebabMenuXpath + '/button[@class="overflow-menu-trigger"]');

        // click transfer in dropdown
        await clickXpath('//button[@class="studio-member-tile-menu-wide"]');
        await findByXpath('//div[contains(@class, "transfer-info-title")]');

        // click next button
        await clickXpath('//button[contains(@class, "next-button")]');
        await findByXpath('//div[@class="transfer-selection-heading"]');

        // click user tile
        await clickXpath(`//div[contains(text(), "${username3}")]`);
        await findByXpath('//div[contains(@class, "transfer-host-name-selected")]');

        // click next button
        await clickXpath('//button[contains(@class, "next-button")]');
        await findByXpath('//div[@class="transfer-outcome"]');

        // enter password
        let passwordInput = await findByXpath('//input[@class="transfer-password-input"]');
        await passwordInput.sendKeys(password);
        await findByXpath(`//input[@value="${password}"]`);

        // click confirm
        // await clickXpath('//button[contains(@class, "confirm-transfer-button")]')
        await clickXpath('//span[contains(text(), "Confirm")]/..');
        let transferSuccess = await findByXpath('//div[contains(@class, "alert-success")]');
        let successVisible = await transferSuccess.isDisplayed();
        expect(successVisible).toBe(true);
    });
});
