import adapter from '@sveltejs/adapter-static';

const config = {
  kit: {
    serviceWorker: { register: false },
    adapter: adapter({
      fallback: '404.html'
    })
  }
};

export default config;
