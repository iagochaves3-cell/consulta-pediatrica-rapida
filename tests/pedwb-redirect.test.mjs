import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../pedwb/index.html', import.meta.url), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script, 'redirect script not found');

function redirectFor(hash) {
  let destination;
  const context = {
    window: {
      location: {
        hash,
        replace(url) {
          destination = url;
        },
      },
    },
  };

  vm.runInNewContext(script, context);
  return destination;
}

test('redirects to compeniowb and preserves the topic hash', () => {
  assert.equal(
    redirectFor('#tema-1'),
    'https://iagochaves3-cell.github.io/compeniowb#tema-1',
  );
});

test('redirects to compeniowb when no hash is present', () => {
  assert.equal(redirectFor(''), 'https://iagochaves3-cell.github.io/compeniowb');
});
