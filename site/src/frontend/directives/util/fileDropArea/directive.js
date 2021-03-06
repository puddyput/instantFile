module.exports = function fileDropAreaDirective() {
  
  function processDragOverEnter(e) {
    e.preventDefault();
    e.stopPropagation();
  };

  return {
    restrict: 'A',
    scope: {
      'file': '=fileDropArea'
    },
    link: function($scope, element, attributes) {
      element.bind('dragover', processDragOverEnter);
      element.bind('dragenter', processDragOverEnter);

      element.bind('drop', function(e) {
        e.preventDefault();

        $scope.file = e.dataTransfer.files[0];

        $scope.$apply();

        return false;
      });
    }
  };
};