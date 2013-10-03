
var shortStraw = require( './short-straw' );

function Point( x, y, t ) {
  this.x = x;
  this.y = y;
  t && ( this.t = t );
}

Point.prototype.clone = function() {
  return new Point( this.x, this.y, this.t );
};

Point.prototype.distanceTo = function( p ) {
  var dx = this.x - p.x, dy = this.y - p.y;
  return Math.sqrt( dx*dx + dy*dy );
};

function Rectangle( x, y, w, h ) {
  this.x = x;
  this.y = y;
  this.width = w;
  this.height = h;
}

function diff( array, substract ) {
  substract || ( substract = function( a, b ) { return a - b; } );
  var len = array.length;
  var i, p0, p1, out = [];
  for ( i = 1; i < len; ++i ) {
    p0 = array[i-1];
    p1 = array[i];
    out.push( substract( p1, p0 ) );
  }
  return out;
}

var deg2Rad = function() {
  var scale = Math.PI / 180.0;
  return function( d ) { return d * scale; };
}();

var rad2Deg = function() {
  var scale = 180.0 / Math.PI;
  return function( d ) { return d * scale; };
}();


function Stroke( points ) {
  if ( !( this instanceof Stroke ) ) {
    return new Stroke( points );
  }

  if ( points instanceof Stroke ) {
    return this.copy( points );
  }

  var createStrokePoint = this.createStrokePoint;
  this.points = ( points && points.map( function( point ) {
    return createStrokePoint( point.x, point.y, point.t );
  } ) ) || [];

  this.clearCache();
  return this;
}

// Override this method can change the StrokePoint type
Stroke.prototype.createStrokePoint = function( x, y, t ) {
  return new Point( x, y, t );
};

Stroke.prototype.fromOneDArray = function( arr, hasTimeStamp ) {
  var points = [], i = 0, len = arr.length;
  while ( i < len ) {
    if ( hasTimeStamp === true ) {
      points.push( this.createStrokePoint( arr[ i ], arr[ i + 1 ], arr[ i + 2 ] ) );
      i = i + 3;
    } else {
      points.push( this.createStrokePoint( arr[ i ], arr[ i + 1 ] ) );
      i = i + 2;
    }
  }
  this.points = points;
  return this;
};

Stroke.prototype.fromArray = function( arr ) {
  var createPoint = this.createStrokePoint;
  this.points = arr.map( function( el ) {
    return createPoint.apply( null, el );
  } );
  this.clearCache();
  return this;
};

Stroke.prototype.clearCache = function() {
  this._cache = {};
  return this;
};

Stroke.prototype.clone = function() {
  var newPoints = this.points.map( function( point ) { return point.clone(); } );
  var newStroke = new Stroke( newPoints );

  // TODO: clone cache as well:

  return newStroke;
};

Stroke.prototype.copy = function( stroke ) {
  var newStroke = stroke.clone();
  this.points = newStroke.points;
  this._cache = newStroke._cache;
  return this;
};

Stroke.prototype.getFirstPoint = function() {
  return this.points[0];
};

Stroke.prototype.getLastPoint = function() {
  var points = this.points;
  return points[ points.length - 1 ];
};

Stroke.prototype.getSample = function( n ) {
  n || ( n = 64 );
  if ( !this._cache.samples ) {
    this._cache.samples = {};
    if ( !this._cache.samples[n] ) {
      var sample = this.clone().resample( n );
      this._cache.samples[n] = sample;
    }
  }
  return this._cache.samples[n];
};

Stroke.prototype.getCentroid = function() {
  if ( !this._cache.centroid ) {
    var x = 0.0, y = 0.0, points = this.points;
    for (var i = 0; i < points.length; i++) {
	  x += points[ i ].x;
	  y += points[ i ].y;
    }
    x /= points.length;
    y /= points.length;
    this._cache.centroid = this.createStrokePoint( x, y );
  }
  return this._cache.centroid;
};

Stroke.prototype.getBoundingBox = function() {
  if ( !this._cache.centroid ) {
    var minX = +Infinity, maxX = -Infinity, minY = +Infinity, maxY = -Infinity;
    var points = this.points;
    for ( var i = 0; i < points.length; ++i ) {
	  minX = Math.min( minX, points[i].x );
	  minY = Math.min( minY, points[i].y );
	  maxX = Math.max( maxX, points[i].x );
	  maxY = Math.max( maxY, points[i].y );
    }
    this._cache.boundingBox = new Rectangle( minX, minY, maxX - minX, maxY - minY );
  }
  return this._cache.boundingBox;
};

Stroke.prototype.getIndicativeAngle = function() {
  if ( !this._cache.indicativeAngle ) {
    var c = this.getCentroid(), points = this.points;
    this._cache.indicativeAngle = Math.atan2( c.y - points[0].y, c.x - points[0].x );
  }
  return this._cache.indicativeAngle;
};

Stroke.prototype.getVectorRep = function() {
  if ( !this._cache.vectorRep ) {
    var points = this.points;
    var sum = 0.0;
    var vector = [];

    points.forEach( function( p ) {
      var x = p.x, y = p.y;
      vector.push( x );
      vector.push( y );
      sum += x*x + y*y;
    } );

    var magnitude = Math.sqrt( sum );

    this._cache.vectorRep = vector.map( function( el ) {
      return el / magnitude;
    } );

  }

  return this._cache.vectorRep;
};

Stroke.prototype.getAngles = function() {
  if ( !this._cache.angles ) {
    var atan2 = Math.atan2;
    var diff = this.getDiff();
    this._cache.angles = diff.map( function( p ) {
      return atan2( p.y, p.x );
    } );
  }
  return this._cache.angles;
}

Stroke.prototype.getAnglesInDeg = function() {
  return this.getAngles().map( rad2Deg );
}

Stroke.prototype.getAnglesDiff = function() {
  if ( !this._cache.anglesDiff ) {
    this._cache.anglesDiff = diff( this.geAngles() );
  }
  return this._cache.anglesDiff;
}

Stroke.prototype.getAnglesDiffInDeg = function() {
  return this.getAnglesDiff().map( rad2Deg );
}

Stroke.prototype.getDiff = function() {
  if ( !this._cache.diff ) {
    this._cache.diff = diff( this.points, function( a, b ) {
      return {
        x: a.x - b.x,
        y: a.y - b.y,
      }
    } );
    // var points = this.points, len = points.length;
    // var i, p0, p1, dx, dy, diff = [];
    // for ( i = 1; i < len; ++i ) {
    //   p0 = points[i-1];
    //   p1 = points[i];
    //   dx = p1.x - p0.x;
    //   dy = p1.y - p0.y;
    //   diff.push( { x: dx, y: dy } );
    // }
    // this._cache.diff = diff;
  }
  return this._cache.diff;
};

Stroke.prototype.getPathLength = function() {
  if ( !this._cache.pathLength ) {
    var d = 0.0, points = this.points;
    for ( var i = 1; i < points.length; i++ ) {
	  d += points[ i - 1 ].distanceTo( points[ i ] );
    }
    this._cache.pathLength = d;
  }
  return this._cache.pathLength;
};

Stroke.prototype.getNumOfPoints = function() {
  return this.points.length;
};

Stroke.prototype.getPointAt = function( ind ) {
  return this.points[ ind ];
};

Stroke.prototype.getCorners = function() {
  if ( !this._cache.corners ) {
    // FIXME: reimplement

    this._cache.corners = shortStraw( this.points );
  }
  return this._cache.corners;
};

Stroke.prototype.distanceTo = function( stroke ) {
  var d = 0.0, pts1 = this.points;
  var newStroke = new Stroke( stroke );

  // Ensure pts1.length == pts2.length
  if ( pts1.length !== newStroke.points.length ) {
    newStroke.resample( pts1.length );
  }
  var pts2 = newStroke.points;

  for ( var i = 0; i < pts1.length; ++i ) {
	d += pts1[ i ].distanceTo( pts2[ i ] );
  }

  return d / pts1.length;
};

var AngleRange = deg2Rad( 45.0 );
var AnglePrecision = deg2Rad( 2.0 );
var Phi = 0.5 * ( -1.0 + Math.sqrt( 5.0 ) );

Stroke.prototype.distanceAtAngle = function( stroke, angleInRadians ) {
  var newStroke = this.clone().rotateBy( angleInRadians );
  return newStroke.distanceTo( stroke );
};

Stroke.prototype.distanceAtBestAngle = function( stroke, a, b, threshold ) {
  a || ( a = -AngleRange );
  b || ( b = AngleRange );
  threshold || ( threshold = AnglePrecision );

  var x1 = Phi * a + ( 1.0 - Phi ) * b;
  var f1 = this.distanceAtAngle( stroke, x1 );

  var x2 = ( 1.0 - Phi ) * a + Phi * b;
  var f2 = this.distanceAtAngle( stroke, x2);

  while ( Math.abs( b - a ) > threshold ) {
	if (f1 < f2) {
	  b = x2;
	  x2 = x1;
	  f2 = f1;
	  x1 = Phi * a + (1.0 - Phi) * b;
	  f1 = this.distanceAtAngle( stroke, x1 );
	} else {
	  a = x1;
	  x1 = x2;
	  f1 = f2;
	  x2 = (1.0 - Phi) * a + Phi * b;
	  f2 = this.distanceAtAngle( stroke, x2 );
	}
  }
  return Math.min( f1, f2 );
};

Stroke.prototype.optimalCosineDistance = function( stroke ) {
  var v1 = this.getVectorRep();
  stroke = new Stroke( stroke );
  var v2 = stroke.getVectorRep();

  var a = 0.0;
  var b = 0.0;
  for ( var i = 0; i < v1.length; i += 2 ) {
	a += v1[i] * v2[i] + v1[i + 1] * v2[i + 1];
    b += v1[i] * v2[i + 1] - v1[i + 1] * v2[i];
  }
  var angle = Math.atan(b / a);
  return Math.acos( a * Math.cos( angle ) + b * Math.sin( angle ) );
};

Stroke.prototype.reverse = function() {
  this.points.reverse();
  this.clearCache();
  return this;
};

Stroke.prototype.flipX = function() {
  this.points.forEach( function( p ) {
    p.x = -p.x;
  } );
  this.clearCache();
  return this;
};

Stroke.prototype.flipY = function() {
  this.points.forEach( function( p ) {
    p.y = -p.y;
  } );
  this.clearCache();
  return this;
};

var numPoints = 64;
Stroke.prototype.resample = function( n ) {

  n || ( n = numPoints );
  var points = this.points;
  var createStrokePoint = this.createStrokePoint;

  var I = this.getPathLength() / ( n - 1 );
  var D = 0.0;

  var newPoints = [ points[0] ];

  for ( var i = 1; i < points.length; i++ ) {
	var d = points[ i - 1 ].distanceTo( points[i] );
	if ( ( D + d ) >= I ) {
	  var qx = points[i - 1].x + ( (I - D) / d ) * ( points[i].x - points[i - 1].x );
	  var qy = points[i - 1].y + ( (I - D) / d ) * ( points[i].y - points[i - 1].y );
	  var q = createStrokePoint( qx, qy );
	  newPoints.push( q );
	  points.splice( i, 0, q );
	  D = 0.0;
	} else {
      D += d;
    }
  }

  // somtimes we fall a rounding-error short of adding the last point, so add it if so
  if ( newPoints.length === n - 1 ) {
	newPoints.push( createStrokePoint( points[ points.length - 1].x, points[ points.length - 1 ].y ) );
  }

  this.points = newPoints;

  this.clearCache();
  return this;
};


Stroke.prototype.rotateBy = function( angleInRadians ) {

  var points = this.points;
  var c = this.getCentroid( points );
  var cos = Math.cos( angleInRadians );
  var sin = Math.sin( angleInRadians );

  points.forEach( function( p ) {
    var newX = ( p.x - c.x ) * cos - ( p.y - c.y ) * sin + c.x;
	var newY = ( p.x - c.x ) * sin + ( p.y - c.y ) * cos + c.y;
    p.x = newX;
    p.y = newY;
  } );

  this.clearCache();
  return this;
};

Stroke.prototype.scaleTo = function( w, h ) {
  if ( arguments.length === 1 ) {
    return this.scaleTo( w, w );
  }

  var points = this.points;
  var B = this.getBoundingBox( points );

  points.forEach( function( p ) {
    p.x = p.x * ( w / B.width );
    p.y = p.y * ( h / B.height );
  } );

  this.clearCache();
  return this;
};

Stroke.prototype.translateTo = function( p ) {
  var points = this.points;
  var c = this.getCentroid();
  var dx = p.x - c.x, dy = p.y - c.y;

  points.forEach( function( p ) {
    p.x += dx;
    p.y += dy;
  } );

  this.clearCache();
  return this;
};

module.exports = exports = Stroke;

// exports.Stroke = Stroke;
// exports.Point = Point;
// exports.Rectangle = Rectangle;
// exports.deg2Rad = deg2Rad;
