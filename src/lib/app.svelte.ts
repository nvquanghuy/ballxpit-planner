// The imperative shell: the one place the run lives, and its only link to the URL.
// Everything it does to the run goes through the pure step() in run.ts.
import { catalog, targets } from './data';
import { parseRun, step, toUrl, type Action, type Session } from './run';
import { decodeHash, encodeHash } from './urlCodec';

let session = $state.raw<Session>({ run: parseRun(decodeHash(location.hash), catalog, targets), undo: null });

const save = () => history.replaceState(null, '', '#' + encodeHash(toUrl(session.run)));
save();

/** Read-only view of the run (reactive). */
export const app = {
  get run() {
    return session.run;
  },
  get undo() {
    return session.undo;
  },
};

export function dispatch(a: Action) {
  session = step(session, a);
  save();
}
