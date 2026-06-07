import api from './api';

export const subscriptionApi = {
  getSubscription: () => api.get('/subscription'),
  createRazorpaySubscription: () => api.post('/subscription/razorpay'),
};
