
var stroke = require( 'ise-stroke' );
var arrgen = require( 'arr-gen' );
var expect = require( 'expect.js' );

describe( 'ise-stroke', function() {

  it( 'should return reversed', function() {
    var pts1 = arrgen( 10, function( i ) {
      return { x: i, y: i };
    } );

    var pts2 = arrgen( 10, function( i ) {
      return { x: 9 - i, y: 9 - i };
    } );

    var revPts1 = stroke( pts1 ).reverse().points;

    expect( revPts1 ).to.eql( pts2 );
  } );

} );
