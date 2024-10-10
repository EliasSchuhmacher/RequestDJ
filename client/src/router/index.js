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
router.beforeEach(async (to, from, next) => {
  if (to.path === "/admin" && !store.state.authenticated) {
    console.info("Unauthenticated user. Redirecting to login page.");
    next("/login");
    return;
  } 
  
  // Handle DJ existence check for "/requestsong/:DJ_name"
  // if (to.path.startsWith("/requestsong/")) {
  //   const djName = to.params.DJ_name;
  //   //const validDJs = store.state.djList; // Assume the list of DJs is stored in Vuex
  //   try {
  //     const response = await fetch(`/api/check_dj_exist`, {
  //       method: "POST",
  //       headers: { "Content-Type": "application/json" },
  //       body: JSON.stringify({ djName }),
  //     });

  //     if (response.ok) {
  //       next(); // DJ exists, proceed to the route
  //       return;
  //     } else {
  //       console.info(`DJ ${djName} not found. Redirecting to not found page.`);
  //       next("/not-found"); // DJ does not exist, redirect to "not found"
  //     }
  //   } catch (error) {
  //     console.error("Error occurred.", error);
  //     next("/not-found"); // Redirect to "not found" in case of a network error
  //   }

  //   // If the DJ does not exist, redirect to a "not found" page
  // if (!validDJs || !validDJs.includes(djName)) {
  //     console.info(`DJ ${djName} not found. Redirecting to not found page.`);
  //     next("/not-found"); // Or use another appropriate route
  //     return;
  //   }
  // }

  next()
});

export default router;
