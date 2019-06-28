/* 
  Old school workarounds for CSS headaches
   mainly controlling some elements size
   based on the viewport height and width
*/
$(document).ready(function() {

  /* 
    Performs all the functions required upon
     screen resize
  */
  var resizeStuff = function() {
    var vH = $(window).height();
    var vW = $(window).width();
    $("body").css({ height: vH, width: vW });
    // Prevent the sidebar from limiting its length
    //  to its contents and in doing so it limits the
    //  height of the adjacent map
    $("#sidebar").css({ height: vH - $("#sidebar").offset().top });
    // Prevent list from extending below window size
    //  by setting its height using jQuery taking into
    //  consideration placement of the list
    $(".list-group").css({ height: vH - $(".list-group").offset().top });
    // Center toast only if screen width is more than
    //  the toast's maximum width
    if (vW > 352) {
      $(".toast").css({ left: (vW - $(".toast").width()) / 2 });
    } else {
      $(".toast").css({ left: 0 });
    }
  };

  // Whenever the window size changes (and so the
  //  viewport size changes) call the beautiful
  //  resize function
  $(window).resize(function() {
    resizeStuff();
  });
  resizeStuff();

  // $("#sidebarCollapse").on("click", function() {
  //   $("#sidebar").toggleClass("active");
  // });
});
