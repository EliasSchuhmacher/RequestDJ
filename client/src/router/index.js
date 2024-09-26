import { createRouter, createWebHistory } from "vue-router";
import store from "../store";
import Login from "../views/Login.vue";
import Admin from "../views/Admin.vue";
import ShowTimeslots from "../views/ShowTimeslots.vue";
import Booking from "../views/Booking.vue";
import SignupForm from "../views/SignupForm.vue";
import RequestSong from "../views/RequestSong.vue";

const routes = [
  {
    path: "/",
    redirect: "/login",
  },
  {
    path: "/login",
    component: Login,
  },
  {
    path: "/signup",
    component: SignupForm,
  },
  {
    path: "/admin",
    component: Admin,
  },
  {
    path: "/timeslots",
    component: ShowTimeslots,
  },
  {
    path: "/booking",
    component: Booking,
  },
  {
    path: "/requestsong/:DJ_name",
    component: RequestSong,
    props: true,
  }
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

// Setup authentication guard.
router.beforeEach((to, from, next) => {
  if (to.path === "/admin" && !store.state.authenticated) {
    console.info("Unauthenticated user. Redirecting to login page.");
    next("/login");
  } else {
    next();
  }
});

export default router;
