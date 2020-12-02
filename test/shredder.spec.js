'use strict';

const {expect} = require('chai');
const Shredder = require('../lib/shredder.js');
const bimBam = {bim: 'bam'};
const bimBamBoum = [];
const grosMinet = {gros: 'minet'};

describe('Shredder can', function () {
  it('#set', function () {
    const s = new Shredder(bimBam);
    const n = s.set('titi', grosMinet);

    expect(n.toJS()).to.be.eql(
      Object.assign({}, bimBam, {
        titi: grosMinet,
      })
    );

    expect(s.toJS()).to.be.eql(bimBam);
  });

  it('#set a cool path', function () {
    const s = new Shredder(bimBam);

    const n = s.set('blim.bla.boom[1].splif[3].splaf', grosMinet);

    expect(n.toJS()).to.be.eql({
      bim: 'bam',
      blim: {
        bla: {
          boom: [
            undefined,
            {
              splif: [
                undefined,
                undefined,
                undefined,
                {
                  splaf: grosMinet,
                },
              ],
            },
          ],
        },
      },
    });

    expect(s.toJS()).to.be.eql(bimBam);
  });

  it('#del', function () {
    const s = new Shredder(bimBam);
    const n = s.del('bim');

    expect(n.toJS()).to.be.eql({});
  });

  it('#test map vs mapShredder', function () {
    let l = new Shredder(bimBamBoum);

    for (let i = 0; i < 2_000_000; i++) {
      l = l.push('', i);
    }

    for (let i = 0; i < 3; i++) {
      console.time('test1: map');
      l.map((item) => item);
      console.timeEnd('test1: map');
    }

    for (let i = 0; i < 3; i++) {
      console.time('test2: mapShredder');
      let l = new Shredder(bimBamBoum);
      l.map((item, ...args) => {
        item = new Shredder(item);
        return (item, ...args) => item;
      });
      console.timeEnd('test2: mapShredder');
    }
  });
});
