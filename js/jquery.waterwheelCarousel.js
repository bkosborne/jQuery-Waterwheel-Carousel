/*
 * Waterwheel Carousel
 * Version 2.0
 * http://www.bkosborne.com
 *
 * Copyright 2011-2013 Brian Osborne
 * Licensed under GPL version 3
 * http://www.gnu.org/licenses/gpl.txt
 * 
 * Plugin written by Brian Osborne
 * for use with the jQuery JavaScript Framework
 * http://www.jquery.com
 */
(function ($) {

  $.fn.waterwheelCarousel = function (options) {

    // override the default options with user defined options
    options = $.extend({}, $.fn.waterwheelCarousel.defaults, options || {});

    return $(this).each(function () {

      /* These are univeral values that are used throughout the plugin. Do not modify them
       * unless you know what you're doing. Most of them feed off the options
       * so most customization can be achieved by modifying the options values */
      var data = {
        itemsContainer:         $(this).find(".carousel-images"),
        totalItems:             $(this).find(".carousel-images img").length,
        containerWidth:         $(this).width(),
        containerHeight:        $(this).height(),
        currentCenterItem:      null,
        items:                  [],
        calculations:           [],
        carouselRotationsLeft:  0,
        currentlyMoving:        false,
        itemsAnimating:         0,
        currentSpeed:           options.speed,
        intervalTimer:          null,
        currentDirection:       'forward'
      };

      // Setup the carousel
      beforeLoaded();
      // Preload the images. Once they are preloaded, the passed in function
      // will be called and the carousel will be setup
      preload(function () {
        preCalculatePositionProperties();
        setupCarousel();
        setupStarterRotation();
      });

      /**
       * This function will set the autoplay for the carousel to
       * automatically rotate it given the time in the options
       * Can clear the autoplay by passing in true
       */
      function autoPlay(stop) {
        // clear timer
        clearTimeout(data.autoPlayTimer);
        // as long as no stop command, and autoplay isn't zeroed...
        if (!stop && options.autoPlay !== 0) {
          // set timer...
          data.autoPlayTimer = setTimeout(function () {
            // to move the carousl in either direction...
            if (options.autoPlay > 0) {
              moveOnce(false);
            } else {
              moveOnce(true);
            }
          }, Math.abs(options.autoPlay));
        }
      }

      // get previous feature number - accounts for wrap around
      function getPreviousNum(num) {
        var newNum = (num === 1) ? null : num - 1;
        return newNum;
      }

      // get next feature number - accounts for wrap around
      function getNextNum(num) {
        var newNum = (num === data.totalItems) ? null : num + 1;
        return newNum;
      }

      // We want to hide all the images to make sure the viewer doesn't
      // see them before the carousel moves them to proper positions
      function beforeLoaded() {
        data.itemsContainer.find('img').hide();
      }

      /**
       * This function will preload all the images in the carousel before
       * calling the passed in callback function. This is VERY necessary for
       * the carousel to function properly because it depends heavily on the
       * width and height of images (which can only be determined post-load)
       */
      function preload(callback) {
        var $imageElements = data.itemsContainer.find('img'), loadedImages = 0, totalImages = $imageElements.length;

        $imageElements.each(function () {
          // Attempt to load the images
          $(this).load(function () {
            // Add to number of images loaded and see if they are all done yet
            loadedImages += 1;
            if (loadedImages === totalImages) {
              // All done, perform callback
              callback();
            }
          });
          // The images may already be cached in the browser, in which case they
          // would have a 'true' complete value and the load callback would never be
          // fired. This will fire it manually.
          if (this.complete || $.browser.msie) {
            $(this).trigger('load');
          }
        });
      }

      /**
       * For each "visible" item slot (# of flanking items plus the middle),
       * we pre-calculate all of the properties that the item should possess while
       * occupying that slot. This saves us some time during the actual animation.
       */
      function preCalculatePositionProperties() {
        // The 0 index is the center item in the carousel
        var $firstItem = data.itemsContainer.find('img:first');
        data.calculations[0] = {
          distance: 0,
          offset:   0,
          width:    $firstItem.width(),
          height:   $firstItem.height(),
          opacity:  1
        }

        // Then, for each number of flanking items (plus one more, see below), we
        // perform the calcations based on our user options
        var horizonOffset = options.horizonOffset;
        var separation = options.separation;
        for (var i = 1; i <= options.flankingItems + 2; i++) {
          if (i > 1) {
            horizonOffset *= options.horizonOffsetMultiplier;
            separation *= options.separationMultiplier;
          }
          data.calculations[i] = {
            distance: data.calculations[i-1].distance + separation,
            offset:   data.calculations[i-1].offset + horizonOffset,
            width:    data.calculations[i-1].width * options.sizeMultiplier,
            height:   data.calculations[i-1].height * options.sizeMultiplier,
            opacity:  data.calculations[i-1].opacity * options.opacityMultipler
          }
        }
        // We performed 1 extra set of calculations above so that the items that
        // are moving out of sight (based on # of flanking items) gracefully animate there
        // However, we need them to animate to hidden, so we set the opacity to 0 for
        // that last item
        data.calculations[options.flankingItems+1].opacity = 0;
      }

      /**
       * Here we prep the carousel and its items, like setting default CSS
       * attributes. All items start in the middle position by default
       * and will "fan out" from there during the first animation
       */
      function setupCarousel() {
        // Fill in a data array with jQuery objects of all the images
        data.items = data.itemsContainer.find('img');
        for (var i = 0; i < data.items.length; i++) {
          data.items[i] = $(data.items[i]);
        }

        data.itemsContainer
          .css('position','relative')
          .find('img')
            .each(function (i) {
              // Put all images in the center default position
              var newLeft,newTop;
              if (options.orientation === "horizontal") {
                newLeft = (data.containerWidth / 2) - ($(this).width() / 2);
                newTop = options.horizon - ($(this).height() / 2);
              } else {
                newLeft = options.horizon - ($(this).width() / 2);
                newTop = (data.containerHeight / 2) - ($(this).height() / 2);
              }
              $(this)
                // Apply positioning and layering to the images
                .css({
                  'left': newLeft,
                  'top': newTop,
                  'visibility': 'visible',
                  'position': 'absolute',
                  'z-index': options.flankingItems+2,
                  'opacity': 1
                })
                // Give each image a data object so it remembers specific data about
                // it's original form
                .data({
                  currentPosition:  0,
                  oldPosition:      0,
                  width:            $(this).width(),
                  owidth:           $(this).width(),
                  height:           $(this).height(),
                  oheight:          $(this).height(),
                  top:              newTop,
                  left:             newLeft,
                  opacity:          1,
                  index:            i
                })
                // The image has been setup... Now we can show it
                .show();
            });
      }

      /**
       * All the items to the left and right of the center item need to be
       * animated to their starting positions. This function will
       * figure out what items go where and will animate them there
       */
      function setupStarterRotation() {
        // Do we need to calculate the starting item?
        options.startingItem = (options.startingItem === 0) ? Math.round(data.totalItems / 2) : options.startingItem;
      
        // We will be rotating the carousel, so we set the animation queue to one
        data.carouselRotationsLeft = 1;
        
        // add active class to center item
        data.items[options.startingItem-1].addClass(options.activeClassName);
        // fire movedToCenter callback manually - since this item never animates to the center
        options.movedToCenter(data.items[options.startingItem-1]);
        // set current center item
        data.currentCenterItem = data.items[options.startingItem-1];

        var counter, itemNum, i;
        counter = 1;
        // Move all the left side items to their proper positions
        for (itemNum = options.startingItem - 2; itemNum >= 0; itemNum--) {
          for (i = 0; i < counter; i++) {
            moveItem(data.items[itemNum], data.items[itemNum].data('currentPosition') - 1, false);
          }
          counter++;
        }

        counter = 1;
        // Move all the right side items to their proper positions
        for (itemNum = options.startingItem; itemNum < data.items.length; itemNum++) {
          for (i = 0; i < counter; i++) {
            moveItem(data.items[itemNum], data.items[itemNum].data('currentPosition') + 1, true);
          }
          counter++;
        }
      }

      /**
       * Given the item and position, this function will calculate the new data
       * for the item. One the calculations are done, it will store that data in
       * the items data object
       */
      function performCalculations($item, newPosition) {
        // Distance to the center
        var oldPosition = $item.data().currentPosition;
        var newDistanceFromCenter = Math.abs(newPosition);

        var newWidth = data.calculations[newDistanceFromCenter].width;
        var newHeight = data.calculations[newDistanceFromCenter].height;
        var widthDifference = Math.abs($item.data().width - newWidth);
        var heightDifference = Math.abs($item.data().height - newHeight);

        // Determine new top value for this item
        var newOffset = data.calculations[Math.abs(newPosition)].offset
        var newTop = options.horizon - newOffset - (newHeight / 2);

        // Determine the new left value for this item
        var center = data.containerWidth / 2;
        var newDistance = data.calculations[Math.abs(newPosition)].distance;
        if (newPosition < 0) {
          newDistance *= -1;
        }
        var newLeft = center + newDistance - (newWidth / 2);

        /** CALCULATE NEW OPACITY OF THE ITEM **/
        var newOpacity;
        if (newPosition === 0) {
          newOpacity = 1;
        } else {
          newOpacity = data.calculations[Math.abs(newPosition)].opacity;
        }

        // Depth will be reverse distance from center
        var newDepth = options.flankingItems + 2 - newDistanceFromCenter;
        // Set calculations
        $item.data('width',newWidth);
        $item.data('height',newHeight);
        $item.data('top',newTop);
        $item.data('left',newLeft);
        $item.data('oldPosition',oldPosition);
        $item.data('currentPosition',newPosition);
        $item.data('depth',newDepth);
        $item.data('opacity',newOpacity);
      }

      /**
       * This function is called when moving an item in the given direction.
       * It will figure out the new position based on the direction of the carousel
       * and then obtain the new calcuations for the item and apply them
       */
      function moveItem($item, newPosition) {
        // Get old and new positions
        var oldPosition = $item.data('currentPosition');
        
        // Only want to physically move the item if it is within the boundaries
        // or in the first position just outside either boundary
        if (Math.abs(newPosition) <= options.flankingItems + 1) {
          // increment number of items animating
          data.itemsAnimating++;
          // Obtain the updated data values for the item
          performCalculations($item, newPosition);
          // NOTE: After this method is called, the items data object has updated
          // position values
          
          // is item moving to center?
          if (newPosition === 0) { options.movingToCenter($item); }
          // is item moving away from center?
          if (oldPosition === 0) {
            options.movingFromCenter($item); // fire callback
            $item.removeClass(options.activeClassName);
          }

          // Change depth of item right away based on its new position
          $item.css('z-index',$item.data().depth);
          $item
            // Animate the items to their new position values
            .animate({
              left: $item.data().left,
              width: $item.data().width,
              height: $item.data().height,
              top: $item.data().top,
              opacity: $item.data().opacity
            },data.currentSpeed,options.animationEasing, function () {
              // Animation for the item has completed, call method
              itemAnimationComplete($item, newPosition);
            });
        // If the item is moving further outside of the boundary, don't move it,
        // just increment its position
        } else  {
          $item.data('oldPosition',oldPosition);
          $item.data('currentPosition',newPosition);
        }

      }

      /**
       * This function is called once an item has finished animating to its
       * given position. Several different statements are executed here, such as
       * dealing with the animation queue
       */
      function itemAnimationComplete($item, newPosition) {
        // If the item moved to the center position, change the data indicating so
        // We simply need to keep track of it so we can call the moved to center event
        // once we are positive all of the animations are complete
        if (newPosition === 0) {
          data.currentCenterItem = $item;
          // add active class to item
          $item.addClass(options.activeClassName);
        }
        
        // Was this item moved away from the center? fire callback
        if ($item.data().oldPosition === 0) {
          options.movedFromCenter($item);
        }

        // Decrement one from the amount of items that are animating
        data.itemsAnimating--;
        // If there are no more items left animating, that means that all the items within
        // the carousel have finished animating
        if (data.itemsAnimating === 0) {
          // Decrement one from the amount of rotations the carousel has made
          data.carouselRotationsLeft -= 1;
          // The carousel has finished rotating and is no longer moving
          data.currentlyMoving = false;
          // If there are still rotations left in the queue, rotate the carousel again
          // we pass in zero because we don't want to add any additional rotations
          if (data.carouselRotationsLeft > 0) {
            rotateCarousel(0);
          // Otherwise there are no more rotations and...
          } else {
            // Reset the speed of the carousel to original
            data.currentSpeed = options.speed;
            // Trigger custom 'moved to the center' event
            if (data.currentCenterItem !== null) {
              options.movedToCenter(data.currentCenterItem);
            }
            // reset & initate the autoPlay
            autoPlay();
          }
        }
      }

      /**
       * Function called to rotate the carousel the given number of rotations
       * in the given direciton. Will check to make sure the carousel should
       * be able to move, and then adjust speed and move items
       */
      function rotateCarousel(rotations) {
        // Check to see that a rotation is allowed
        if (data.currentlyMoving === false) {

          // Carousel is now moving
          data.currentlyMoving = true;
          // Reset items animating to zero
          data.itemsAnimating = 0;
          // Add given rotations to queue
          data.carouselRotationsLeft += rotations;
          
          if (options.quickerForFurther === true) {
	          // Figure out how fast the carousel should rotate
	          if (rotations > 1) {
	            data.currentSpeed = options.speed / rotations;
	          }
	          // Assure the speed is above the minimum to avoid weird results
	          data.currentSpeed = (data.currentSpeed < 100) ? 100 : data.currentSpeed;
          } else {
            data.currentSpeed = options.speed;
          }

          // Iterate thru each item and move it
          for (var i = 0; i < data.items.length; i++) {
            var $item = $(data.items[i]);
            var currentPosition = $item.data().currentPosition;

            if (data.currentDirection == 'forward') {
              newPosition = currentPosition - 1;
            } else {
              newPosition = currentPosition + 1;
            }
            // We keep both sides as even as possible to allow circular rotation to work.
            // We will "wrap" the item arround to the other side by negating its current position
            flankingAllowance = Math.floor(data.items.length / 2);
            if (Math.abs(newPosition) > flankingAllowance) {
              newPosition = currentPosition * -1;
            }

            moveItem($item, newPosition);
          }
        }
      }

      /**
       * The event handler when an image within the carousel is clicked
       * This function will rotate the carousel the correct number of rotations
       * to get the clicked item to the center, or will fire the custom event
       * the user passed in if the center item is clicked
       */
      $(this).find('.carousel-images img').live("click", function () {
        // Remove autoplay
        autoPlay(true);
        options.autoPlay = 0;
        
        var itemPosition = $(this).data().currentPosition;
        var rotations = Math.abs(itemPosition);
        if (itemPosition < 0) {
          data.currentDirection = 'backward';
          rotateCarousel(rotations);
        } else if (itemPosition > 0) {
          data.currentDirection = 'forward';
          rotateCarousel(rotations);
        } else {
          options.clickedCenter($(this));
        }
      });

      /**
       * The user may choose to wrap the images is link tags. If they do this, we need to
       * make sure that they aren't active for certain situations
       */
      $(this).find('.carousel-images a').live("click", function (event) {
        var isCenter = ($(this).find('img').width() === $(this).find('img').data().owidth) ? true : false;
        // should we disable the links?
        if (options.linkHandling === 1 || // turn off all links
            (options.linkHandling === 2 && !isCenter)) // turn off all links except center
        {
          event.preventDefault();
          return false;
        }
      });

      /**
       * Event handlers for the optional carousel controls
       */
      $(this).find('.carousel-controls .carousel-prev').live('click',function (e) {
        data.currentDirection = 'backward';
        rotateCarousel(1);

        e.preventDefault();
        return false;
      });
      $(this).find('.carousel-controls .carousel-next').live('click',function (e) {
        data.currentDirection = 'forward';
        rotateCarousel();

        e.preventDefault();
        return false;
      });
      
      /**
       * Navigation with arrow keys
       */
      if (options.keyboardNav) {
        $(document).keydown(function(e) {
          if (e.which === 37 || e.which === 38) {
            // arrow left or up
            data.currentDirection = 'backward';
            rotateCarousel(1);
          } else if (e.which === 39 || e.which === 40) {
            // arrow right or down
            data.currentDirection = 'forward';
            rotateCarousel(1);
          }
          // should we override the normal functionality for the arrow keys?
          if (options.keyboardNavOverride && (e.which === 37 || e.which === 38 || e.which === 39 || e.which === 40)) {
            e.preventDefault();
            return false;
          }
        });
      }

    });
  };

  $.fn.waterwheelCarousel.defaults = {
    // number tweeks to change apperance
    startingItem:               0,   // item to place in the center of the carousel. Set to 0 for auto
    separation:                 150, // distance between items in carousel
    separationMultiplier:       0.6, // multipled by separation distance to increase/decrease distance for each additional item
    horizonOffset:              0,   // offset each item from the "horizon" by this amount
    horizonOffsetMultiplier:    1,   // multipled by horizon offset to increase/decrease offset for each additional item
    sizeMultiplier:             0.7, // determines how drastically the size of each item change
    opacityMultipler:           0.5, // determines how drastically the opacity of each item change
    horizon:                    140, // how "far in" the horizontal/vertical horizon should be set
    flankingItems:              3,   // the number of items visible on either side of the center
    
    // animation
    speed:                      300,      // speed in milliseconds it will take to rotate from one to the next
    animationEasing:            'linear', // the animation easing when rotating each item
    quickerForFurther:          true,     // set to true to make animations faster when clicking an item that is far away from the center
    
    // misc
    linkHandling:               2,            // 1 to disable all (used for facebox), 2 to disable all but center (to link images out)
    autoPlay:                   0,            // indicate the speed in milliseconds to wait before autorotating. 0 to turn off. Can be negative
    orientation:                'horizontal', // indicate if the carousel should be horizontal or vertical
    activeClassName:            'active',     // the name of the class given to the current item in the center
    keyboardNav:                true,        // set to true to move the carousel with the arrow keys
    keyboardNavOverride:        true,         // set to true to override the normal functionality of the arrow keys (prevents scrolling)
    edgeReaction:               'reset',      // what does the carousel do when it reaches an edge? accepted: reset/reverse/nothing
    
    // callback functions
    movingToCenter:             $.noop, // fired when an item is about to move to the center position
    movedToCenter:              $.noop, // fired when an item has finished moving to the center
    clickedCenter:              $.noop, // fired when the center item has been clicked
    movingFromCenter:           $.noop, // fired when an item is about to leave the center position
    movedFromCenter:            $.noop  // fired when an item has finished moving from the center
  };

})(jQuery);
