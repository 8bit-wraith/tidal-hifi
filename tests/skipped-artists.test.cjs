const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');

function fixture() {
  const file = path.join(__dirname, '../src/features/api/features/settings/settings.ts');
  const source = fs.readFileSync(file, 'utf8').replace(/^import[\s\S]*?;\s*/gm, '').replace('export const addSettingsAPI', 'const addSettingsAPI');
  const mutations = [];
  const context = {
    addSkippedArtists: body => mutations.push(['add', body]),
    removeSkippedArtists: body => mutations.push(['remove', body]),
  };
  vm.createContext(context);
  vm.runInContext(stripTypeScriptTypes(source) + '\nthis.register = addSettingsAPI;', context);
  const routes = new Map();
  context.register({get() {}, delete() {}, post(url, handler) { routes.set(url, handler); }}, {});
  return {mutations, invoke(url, body) {
    const response = {code: undefined, status(code) { this.code = code; return this; }, json(value) {this.value = value; return this;}, sendStatus(code) {this.code = code; return this;}};
    routes.get(url)({body}, response);
    return response;
  }};
}

for (const [url, action] of [['/settings/skipped-artists', 'add'], ['/settings/skipped-artists/delete', 'remove']]) {
  for (const body of [undefined, null, 'AB', {}, [42], ['Artist', null]]) {
    test(`${action} rejects ${JSON.stringify(body)} without mutation`, () => {
      const f = fixture();
      assert.equal(f.invoke(url, body).code, 400);
      assert.equal(f.mutations.length, 0);
    });
  }
  for (const body of [[], ['Artist', 'Other Artist']]) {
    test(`${action} accepts ${JSON.stringify(body)}`, () => {
      const f = fixture();
      assert.equal(f.invoke(url, body).code, 200);
      assert.deepEqual(f.mutations, [[action, body]]);
    });
  }
}
