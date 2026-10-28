import { Routes } from '@angular/router';
import { Home } from './pages/home/home';
import { Products } from './pages/products/products';
import { ProductDetails } from './pages/product-details/product-details';
import { ZodiacPage } from './pages/zodiac/zodiac';
import { ZodiacProducts } from './pages/zodiac-products/zodiac-products';
import { Categories } from './pages/categories/categories';
import { Login } from './pages/login/login';
import { Register } from './pages/register/register';
import { ForgotPassword } from './pages/forgot-password/forgot-password';
import { Cart } from './pages/cart/cart';
import { Checkout } from './pages/checkout/checkout';
import { Orders } from './pages/orders/orders';
import { Wishlist } from './pages/wishlist/wishlist';
import { MysteryBox } from './pages/mystery-box/mystery-box';
import { OrderDetails } from './pages/order-details/order-details';
import { TrackOrder } from './pages/track-order/track-order';
import { Profile } from './pages/profile/profile';
import { AccountOverview } from './pages/account-overview/account-overview';
import { AccountLayout } from './components/account-layout/account-layout';
import { Addresses } from './pages/addresses/addresses';
import { About } from './pages/about/about';
import { Faq } from './pages/faq/faq';
import { Contact } from './pages/contact/contact';
import { ShippingReturns } from './pages/shipping-returns/shipping-returns';
import { Privacy } from './pages/privacy/privacy';
import { Terms } from './pages/terms/terms';
import { Guides } from './pages/guides/guides';
import { GuideDetail } from './pages/guide-detail/guide-detail';
import { GUIDES } from './data/guides.data';
import { NotAuthorized } from './pages/not-authorized/not-authorized';
import { NotFound } from './pages/not-found/not-found';
import { Unsubscribe } from './pages/unsubscribe/unsubscribe';
import { authGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';
import { customerGuard } from './guards/customer.guard';
import { shopperGuard } from './guards/shopper.guard';
import { guestOrderGuard } from './guards/guest-order.guard';
import { SITE_NAME } from './services/page-title.service';

export const routes: Routes = [
  { path: '', component: Home, data: { description: 'Shop healing crystals matched to your zodiac sign. Rose quartz, amethyst, citrine and more, with crystal guides, mystery boxes and fast delivery across India.' } },
  { path: 'products', title: 'Shop All Crystals', component: Products, data: { description: 'Browse our full range of healing crystals: tumbled stones, raw clusters, towers and spheres, with zodiac matches for each.' } },
  { path: 'products/:id', title: 'Crystal', component: ProductDetails },
  { path: 'zodiac', title: 'Shop by Zodiac Sign', component: ZodiacPage, data: { description: 'Find the crystals for your zodiac sign, from Aries to Pisces, and the qualities each stone supports.' } },
  { path: 'zodiac/:id', title: 'Zodiac Sign', component: ZodiacProducts },
  { path: 'categories', title: 'Categories', component: Categories, data: { description: 'Shop crystals by type: tumbled stones, raw crystals, towers, spheres, jewellery and more.' } },
  {
    path: 'consultation',
    title: 'Crystal Consultation',
    data: { description: 'Complete our guided crystal consultation to discover the specimens attuned to your astrological blueprint and intentions.' },
    loadComponent: () => import('./pages/consultation/consultation').then(m => m.Consultation)
  },
  { path: 'login', title: 'Login', component: Login, data: { noindex: true } },
  { path: 'register', title: 'Create Account', component: Register, data: { noindex: true } },
  { path: 'forgot-password', title: 'Forgot Password', component: ForgotPassword, data: { noindex: true } },
  {
    path: 'account/revert-email',
    title: 'Restore Your Email',
    data: { noindex: true },
    loadComponent: () => import('./pages/revert-email/revert-email').then(m => m.RevertEmail)
  },
  { path: 'cart', title: 'Your Cart', component: Cart, canActivate: [shopperGuard], data: { noindex: true } },
  { path: 'checkout', title: 'Checkout', component: Checkout, canActivate: [shopperGuard], data: { noindex: true } },
  // Guest order pages (from the emailed link). Same components as My Orders.
  { path: 'order/:id', title: 'Your Order', component: OrderDetails, canActivate: [guestOrderGuard], data: { noindex: true } },
  { path: 'order/:id/track', title: 'Track Package', component: TrackOrder, canActivate: [guestOrderGuard], data: { noindex: true } },
  {
    path: 'order-access',
    title: 'Your Order',
    data: { noindex: true },
    loadComponent: () => import('./pages/order-access/order-access').then(m => m.OrderAccess)
  },
  {
    path: 'find-order',
    title: 'Find My Order',
    data: { description: `Checked out as a guest? Get a private link to track your ${SITE_NAME} order.` },
    loadComponent: () => import('./pages/find-order/find-order').then(m => m.FindOrder)
  },
  {
    path: 'order-placed',
    title: 'Order Placed',
    data: { noindex: true },
    loadComponent: () => import('./pages/order-placed/order-placed').then(m => m.OrderPlaced)
  },
  { path: 'mystery-box', title: 'Mystery Crystal Box', component: MysteryBox, data: { description: 'A surprise box of hand-picked healing crystals, chosen for your zodiac sign.' } },
  // My Account: one shared frame (side menu) around the account pages. The
  // parent has an empty path so every page keeps its existing URL.
  {
    path: '',
    component: AccountLayout,
    canActivate: [authGuard],
    data: { noindex: true },
    children: [
      { path: 'profile', title: 'My Account', component: AccountOverview },
      { path: 'profile/settings', title: 'Account Settings', component: Profile },
      { path: 'profile/addresses', title: 'My Addresses', component: Addresses, canActivate: [customerGuard] },
      { path: 'orders', title: 'My Orders', component: Orders, canActivate: [customerGuard] },
      { path: 'orders/:id', title: 'Order Details', component: OrderDetails, canActivate: [customerGuard] },
      { path: 'orders/:id/track', title: 'Track Package', component: TrackOrder, canActivate: [customerGuard] },
      { path: 'wishlist', title: 'My Wishlist', component: Wishlist, canActivate: [customerGuard] },
      {
        path: 'support',
        title: 'Support Requests',
        canActivate: [customerGuard],
        loadComponent: () => import('./pages/support-tickets/support-tickets').then(m => m.SupportTickets)
      },
      {
        path: 'support/:id',
        title: 'Support Request',
        canActivate: [customerGuard],
        loadComponent: () => import('./pages/support-ticket/support-ticket').then(m => m.SupportTicketPage)
      }
    ]
  },
  { path: 'guides', title: 'Crystal Guides', component: Guides, data: { description: 'Practical crystal guides: how to choose, care for and use crystals, and which stones suit each zodiac sign.' } },
  { path: 'guides/:slug', title: route => GUIDES.find(g => g.slug === route.paramMap.get('slug'))?.title ?? 'Crystal Guides', component: GuideDetail },
  { path: 'about', title: 'About Us', component: About, data: { description: `Who we are and how we source the healing crystals we sell at ${SITE_NAME}.` } },
  {
    path: 'help',
    title: 'Help Center',
    data: { description: `Get help with your ${SITE_NAME} order: tracking, returns, refunds, damaged items and crystal care.` },
    loadComponent: () => import('./pages/help/help').then(m => m.Help)
  },
  { path: 'faq', title: 'FAQ', component: Faq, data: { description: 'Answers to common questions about orders, payment, delivery, returns and our crystals.' } },
  { path: 'contact', title: 'Contact Us', component: Contact, data: { description: `Get in touch with ${SITE_NAME} about orders, products or anything else.` } },
  { path: 'shipping-returns', title: 'Shipping & Returns', component: ShippingReturns, data: { description: `Delivery times, shipping charges and how to return an order from ${SITE_NAME}.` } },
  { path: 'privacy', title: 'Privacy Policy', component: Privacy, data: { description: `How ${SITE_NAME} collects, uses and protects your personal information.` } },
  { path: 'terms', title: 'Terms & Conditions', component: Terms, data: { description: `The terms that apply when you shop with ${SITE_NAME}.` } },
  { path: 'not-authorized', title: 'Not Authorized', component: NotAuthorized, data: { noindex: true } },
  { path: 'unsubscribe', title: 'Unsubscribe', component: Unsubscribe, data: { noindex: true } },
  {
    path: 'admin',
    canActivate: [adminGuard],
    data: { noindex: true },
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        title: 'Dashboard · Admin',
        loadComponent: () => import('./admin/dashboard/dashboard').then(m => m.Dashboard)
      },
      {
        path: 'products',
        title: 'Products · Admin',
        loadComponent: () => import('./admin/products/products').then(m => m.AdminProducts)
      },
      {
        path: 'categories',
        title: 'Categories · Admin',
        loadComponent: () => import('./admin/categories/categories').then(m => m.AdminCategories)
      },
      {
        path: 'zodiac',
        title: 'Zodiac Signs · Admin',
        loadComponent: () => import('./admin/zodiac/zodiac').then(m => m.AdminZodiac)
      },
      {
        path: 'product-images',
        title: 'Product Images · Admin',
        loadComponent: () => import('./admin/product-images/product-images').then(m => m.AdminProductImages)
      },
      {
        path: 'stock',
        title: 'Stock · Admin',
        loadComponent: () => import('./admin/stock/stock').then(m => m.AdminStock)
      },
      {
        path: 'orders',
        title: 'Orders · Admin',
        loadComponent: () => import('./admin/orders/orders').then(m => m.AdminOrders)
      },
      {
        path: 'users',
        title: 'Users · Admin',
        loadComponent: () => import('./admin/users/users').then(m => m.AdminUsers)
      },
      {
        path: 'returns',
        title: 'Returns · Admin',
        loadComponent: () => import('./admin/returns/returns').then(m => m.AdminReturns)
      },
      {
        path: 'support',
        title: 'Support · Admin',
        loadComponent: () => import('./admin/support/support').then(m => m.AdminSupport)
      },
      {
        path: 'reviews',
        title: 'Reviews · Admin',
        loadComponent: () => import('./admin/reviews/reviews').then(m => m.AdminReviews)
      },
      {
        path: 'coupons',
        title: 'Coupons · Admin',
        loadComponent: () => import('./admin/coupons/coupons').then(m => m.AdminCoupons)
      },
      {
        path: 'reports',
        title: 'Reports · Admin',
        loadComponent: () => import('./admin/reports/reports').then(m => m.AdminReports)
      },
      {
        path: 'settings',
        title: 'Store Settings & CMS · Admin',
        loadComponent: () => import('./admin/settings/settings').then(m => m.AdminSettings)
      },
      {
        path: 'audit-logs',
        title: 'Audit Logs · Admin',
        loadComponent: () => import('./admin/audit-logs/audit-logs').then(m => m.AdminAuditLogs)
      },
      {
        path: 'newsletter-subscribers',
        title: 'Newsletter Subscribers · Admin',
        loadComponent: () =>
          import('./admin/newsletter-subscribers/newsletter-subscribers').then(m => m.AdminNewsletterSubscribers)
      }
    ]
  },
  { path: '**', title: 'Page Not Found', component: NotFound, data: { noindex: true } }
];
