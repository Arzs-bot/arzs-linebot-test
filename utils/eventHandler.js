async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }
  return {
    type: 'text',
    text: `您說的是: ${event.message.text}`,
  };
}

module.exports = { handleEvent };