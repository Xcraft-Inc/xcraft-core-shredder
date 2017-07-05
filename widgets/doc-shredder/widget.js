import React from 'react';
import Widget from 'laboratory/widget';
import Content from 'laboratory/content';
import Container from 'gadgets/container/widget';

class ShredderDoc extends Widget {
  constructor (props, context) {
    super (props, context);
  }

  display (data) {
    return JSON.stringify (data, null, '\n');
  }

  renderPanel () {
    return (
      <Container kind="panes">
        <Container kind="pane">
          <Content widgetName="doc-shredder" />
        </Container>
      </Container>
    );
  }

  render () {
    return (
      <Container kind="views">
        <Container kind="view">
          {this.renderPanel ()}
        </Container>
      </Container>
    );
  }
}

export default ShredderDoc;
