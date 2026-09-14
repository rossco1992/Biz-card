import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getSignInErrorMessage, isValidEmail } from '../lib/sign-in.ts';

test('email validation accepts trimmed addresses and plus tags', () => {
  for (const email of [' person@company.com ', 'person+card@sub.company.com']) assert.equal(isValidEmail(email), true);
  for (const email of ['', '   ', 'person', 'person@', '@company.com', 'person@company', 'person name@company.com', 'person@@company.com']) assert.equal(isValidEmail(email), false);
});

test('rate limits take priority over wrapped confirmation-email failures', () => {
  for (const error of [
    { code: 'over_email_send_rate_limit' }, { code: 'over_request_rate_limit' }, { status: 429 },
    new Error('email rate limit exceeded'),
    new Error('Failed to send confirmation email: email rate limit exceeded'),
    new Error('For security purposes, you can only request this after 60 seconds.'),
  ]) assert.match(getSignInErrorMessage(error), /wait a while/);
});

test('delivery failures and restricted recipients have actionable messages', () => {
  for (const error of [new Error('Error sending confirmation email'), new Error('Failed to send confirmation email'), { code: 'email_address_not_authorized' }]) {
    assert.match(getSignInErrorMessage(error), /couldn't deliver.*contact support/);
  }
});

test('invalid addresses, disabled sign-in, and network failures are distinguished', () => {
  assert.match(getSignInErrorMessage({ code: 'email_address_invalid' }), /Check the address/);
  for (const code of ['otp_disabled', 'email_provider_disabled', 'signup_disabled']) assert.match(getSignInErrorMessage({ code }), /temporarily unavailable/);
  for (const error of [new TypeError('Network request failed'), { name: 'AuthRetryableFetchError' }, { code: 'request_timeout' }]) assert.match(getSignInErrorMessage(error), /internet connection/);
});

test('unknown errors never expose raw provider details', () => {
  for (const error of [null, undefined, 'secret', {}, new Error('private internal details'), { message: 123 }]) {
    assert.equal(getSignInErrorMessage(error), "We couldn't send your sign-in link right now. Please try again later.");
  }
});
