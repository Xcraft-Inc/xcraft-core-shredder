'use strict';

const {expect} = require('chai');
const {fromJS} = require('../lib/shredder.js');
const Shredder = require('../lib/shredder.js');
const bimBam = {bim: 'bam'};
const bimBamBoum = [];
const grosMinet = {gros: 'minet'};

describe('xcraft.shredder', function () {
  describe('usage', function () {
    it('set', function () {
      const s = new Shredder(bimBam);
      const n = s.set('titi', grosMinet);

      expect(n.toJS()).to.be.eql(
        Object.assign({}, bimBam, {
          titi: grosMinet,
        })
      );

      expect(s.toJS()).to.be.eql(bimBam);
    });

    it('set an empty path', function () {
      const s = new Shredder(bimBam);

      const n = s.set('', grosMinet);

      expect(n.toJS()).to.be.eql({gros: 'minet'});
      expect(s.toJS()).to.be.eql(bimBam);
    });

    it('set a simple path with a bracket', function () {
      const s = new Shredder(bimBam);

      const n = s.set('boom[1]', grosMinet);

      expect(n.toJS()).to.be.eql({
        bim: 'bam',
        boom: [undefined, {gros: 'minet'}],
      });
      expect(s.toJS()).to.be.eql(bimBam);
    });

    it('set a cool path', function () {
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

    it('del', function () {
      const s = new Shredder(bimBam);
      const n = s.del('bim');

      expect(n.toJS()).to.be.eql({});
    });

    it('find', function () {
      // Return value (not immutable)
      let s = new Shredder(['glace', 'chat', 'bob']);
      let res = s.find((item) => item === 'chat');
      expect(res).to.be.eql('chat');

      // Return shreddder immutable
      s = new Shredder(
        fromJS([{value: 'glace'}, {value: 'chat'}, {value: 'bob'}])
      );
      res = s.find((item) => item.get('value') === 'chat');
      expect(res).to.be.eql(s.get('1'));

      // Return null
      s = new Shredder(
        fromJS([{value: 'glace'}, {value: 'chat'}, {value: 'bob'}])
      );
      res = s.find((item) => item.get('value') === 'test');
      expect(res).to.be.eql(null);
    });
  });

  describe.skip('performance', function () {
    it(`test set/get (×2'000'000)`, function () {
      this.timeout(20000);

      let l = new Shredder(bimBamBoum);

      for (let i = 1; i <= 3; ++i) {
        let path;
        console.time(`test ${i}`);
        for (let i = 0; i < 2_000_000; i++) {
          if (i % 100 === 0) {
            path = `_${process.hrtime.bigint()}._${process.hrtime.bigint()}`;
          }
          l = l.set(path, i);
          l.get(path);
        }
        console.timeEnd(`test ${i}`);
      }
    });

    it(`test map vs mapShredder (×2'000'000)`, function () {
      this.timeout(20000);

      let l = new Shredder(bimBamBoum);

      for (let i = 0; i < 2_000_000; i++) {
        l = l.push('', i);
      }

      for (let i = 1; i <= 3; i++) {
        console.time(`test ${i} map`);
        l.map((item) => item);
        console.timeEnd(`test ${i} map`);
      }

      l = new Shredder(bimBamBoum);

      for (let i = 0; i < 2_000_000; i++) {
        l = l.push('', i);
      }

      for (let i = 1; i <= 3; i++) {
        console.time(`test ${i} mapShredder`);
        l.map((item, ...args) => {
          item = new Shredder(item);
          return (item, ...args) => item;
        });
        console.timeEnd(`test ${i} mapShredder`);
      }
    });
  });
});
