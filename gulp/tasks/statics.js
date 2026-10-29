import { src, dest } from 'gulp';

export function statics() {
  return src('src/*.{txt,xml}', { encoding: false }).pipe(dest('dist/'));
}