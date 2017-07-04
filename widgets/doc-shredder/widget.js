import React from 'react';
import Widget from 'laboratory/widget';

import Button from 'gadgets/button/widget';
import Container from 'gadgets/container/widget';
import Label from 'gadgets/label/widget';

class ShredderDoc extends Widget {
  constructor (props, context) {
    super (props, context);
  }

  renderPanel () {
    return (
      <Container kind="pane">
        <Container kind="row-pane">
          <Label glyph="cube" text="Goblin Shredder" grow="1" kind="title" />
        </Container>
        <Container kind="row-pane" subkind="box">
          ...
        </Container>
      </Container>
    );
  }

  render () {
    return (
      <Container kind="views">
        {this.renderPanel ()}
      </Container>
    );
  }
}

export default ShredderDoc;
